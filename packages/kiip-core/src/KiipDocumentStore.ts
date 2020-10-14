import { KiipFragment, KiipSchema, KiipDocumentState, KiipDatabase, SyncData, KiipDocument } from './types';
import { Clock } from './Clock';
import { Timestamp } from './Timestamp';
import { MerkleTree } from './MerkleTree';
import { Subscription, SubscribeMethod, SubscriptionCallback, OnUnsubscribed, Unsubscribe } from 'suub';
import { createId, DONE_TOKEN } from './utils';

// latest timestamp for each table-row-column
interface Latest {
  [table: string]: { [row: string]: { [column: string]: string } };
}

export interface KiipDocumentStore<Schema extends KiipSchema, Metadata> {
  id: string;
  insert<K extends keyof Schema>(table: K, doc: Schema[K]): Promise<string>;
  update<K extends keyof Schema>(table: K, id: string, doc: Partial<Schema[K]>): Promise<void>;
  subscribe: SubscribeMethod<KiipDocumentState<Schema, Metadata>>;
  getState: () => KiipDocumentState<Schema, Metadata>;
  setMeta: (meta: Metadata) => Promise<void>;
  prepareSync(): SyncData;
  handleSync(data: SyncData): Promise<SyncData>;
  unmount(): void;
}

export function createKiipDocumentStore<Schema extends KiipSchema, Metadata>(
  tx: unknown,
  document: KiipDocument<Metadata>,
  database: KiipDatabase<unknown>,
  onResolve: (store: KiipDocumentStore<Schema, Metadata>) => DONE_TOKEN,
  onReject: (error: any) => DONE_TOKEN,
  onUnmount: () => void
): DONE_TOKEN {
  let unmounted = false;
  const clock = new Clock(document.nodeId);
  let state: KiipDocumentState<Schema, Metadata> = {
    id: document.id,
    nodeId: document.nodeId,
    meta: document.meta,
    data: {} as any,
  };
  const latest: Latest = {};
  const sub = Subscription() as Subscription<KiipDocumentState<Schema, Metadata>>;

  const unsub = database.subscribeDocument(document.id, (doc) => {
    state = {
      ...state,
      meta: doc.meta as Metadata,
      nodeId: doc.nodeId,
    };
    sub.emit(state);
  });

  // apply all fragments
  return database.onEachFragment(
    tx,
    document.id,
    (fragment) => {
      handleFragments([fragment], 'init');
    },
    () => {
      return onResolve({
        id: document.id,
        prepareSync,
        handleSync,
        subscribe,
        getState,
        insert,
        update,
        setMeta,
        unmount,
      });
    },
    onReject
  );

  function throwIfUnmounted() {
    if (unmounted) {
      throw new Error(`Store was unmounted !`);
    }
  }

  function subscribe(
    callback: SubscriptionCallback<KiipDocumentState<Schema, Metadata>>,
    onUnsubscribe?: OnUnsubscribed
  ): Unsubscribe;
  function subscribe(
    subId: string,
    callback: SubscriptionCallback<KiipDocumentState<Schema, Metadata>>,
    onUnsubscribe?: OnUnsubscribed
  ): Unsubscribe;
  function subscribe(...args: Array<any>): Unsubscribe {
    throwIfUnmounted();
    return (sub.subscribe as any)(...args);
  }

  function unmount() {
    if (unmounted) {
      console.warn('Already unmounted');
      return;
    }
    unmounted = true;
    unsub();
    sub.unsubscribeAll();
    onUnmount();
  }

  async function setMeta(newMeta: Metadata): Promise<void> {
    throwIfUnmounted();
    return database.withTransaction((tx, resolve, reject) => {
      return database.setMetadata(
        tx,
        document.id,
        newMeta,
        () => {
          // state = { ...state, meta: newMeta };
          // sub.emit(state);
          return resolve();
        },
        reject
      );
    });
  }

  function getState(): KiipDocumentState<Schema, Metadata> {
    throwIfUnmounted();
    return state as any;
  }

  async function insert<K extends keyof Schema>(table: K, data: Schema[K]): Promise<string> {
    throwIfUnmounted();
    const rowId = createId();
    const fragments: Array<KiipFragment> = Object.keys(data).map((column) => ({
      timestamp: clock.send().toString(),
      documentId: document.id,
      table: table as string,
      column,
      row: rowId,
      value: data[column],
    }));
    return database.withTransaction((tx, resolve, reject) => {
      return database.addFragments(
        tx,
        fragments,
        () => {
          handleFragments(fragments, 'local');
          return resolve(rowId);
        },
        reject
      );
    });
  }

  async function update<K extends keyof Schema>(table: K, id: string, data: Partial<Schema[K]>): Promise<void> {
    throwIfUnmounted();
    const fragments: Array<KiipFragment> = Object.keys(data).map((column) => ({
      timestamp: clock.send().toString(),
      documentId: document.id,
      table: table as string,
      column,
      row: id,
      value: data[column],
    }));
    return database.withTransaction((tx, resolve, reject) => {
      return database.addFragments(
        tx,
        fragments,
        () => {
          handleFragments(fragments, 'local');
          return resolve();
        },
        reject
      );
    });
  }

  // return current markle
  function prepareSync(): SyncData {
    throwIfUnmounted();
    return {
      nodeId: clock.node,
      merkle: clock.merkle,
      // we are sending the merkle tree so we don't have fragments to send
      fragments: [],
    };
  }

  // get remote merkle tree and return fragments
  async function handleSync(data: SyncData): Promise<SyncData> {
    throwIfUnmounted();
    return database.withTransaction((tx, resolve, reject) => {
      return database.addFragments(
        tx,
        data.fragments,
        () => {
          handleFragments(data.fragments, 'receive');
          // then compute response
          const diffTime = MerkleTree.diff(clock.merkle, data.merkle);
          if (diffTime === null) {
            return resolve({
              nodeId: clock.node,
              merkle: clock.merkle,
              fragments: [],
            });
          }
          const timestamp = new Timestamp(diffTime, 0, '0');
          return database.getFragmentsSince(
            tx,
            document.id,
            timestamp,
            data.nodeId,
            (fragments) => {
              return resolve({
                nodeId: clock.node,
                merkle: clock.merkle,
                fragments,
              });
            },
            reject
          );
        },
        reject
      );
    });
  }

  function handleFragments(fragments: Array<KiipFragment>, mode: 'init' | 'local' | 'receive') {
    throwIfUnmounted();
    const prevState = state;
    fragments.forEach((fragment) => {
      if (mode === 'init' || mode === 'receive') {
        clock.recv(Timestamp.parse(fragment.timestamp));
      }
      const mutations = mode === 'init' ? true : false;
      applyFragmentOnState(fragment, { mutations });
    });
    if (state !== prevState && mode !== 'init') {
      sub.emit(state as any);
    }
  }

  function applyFragmentOnState(fragment: KiipFragment, options: { mutations: boolean }) {
    throwIfUnmounted();
    const { column, table, row, timestamp, value } = fragment;
    const latestTable = latest[table] || {};
    const latestRow = latestTable[row] || {};
    const latestTs = latestRow[column];
    if (latestTs === undefined || latestTs < timestamp) {
      const prevData = state.data;
      if (options.mutations) {
        setDeepMutate(state.data, table, row, column, timestamp);
      } else {
        const nextData = setDeep(prevData, table, row, column, value);
        if (nextData !== prevData) {
          state = {
            ...state,
            data: nextData,
          };
        }
      }
      // update latest
      setDeepMutate(latest, table, row, column, timestamp);
    }
  }
}

interface DeepObj<T> {
  [table: string]: { [row: string]: { [column: string]: T } };
}

// Note undefined value will return false
function hasDeep<T>(obj: DeepObj<T>, table: string, row: string, column: string): boolean {
  return obj[table] && obj[table][row] && obj[table][row][column] !== undefined;
}

function getDeep<T>(obj: DeepObj<T>, table: string, row: string, column: string): T | undefined {
  if (hasDeep(obj, table, row, column)) {
    return obj[table][row][column];
  }
  return undefined;
}

function setDeep<U, T extends DeepObj<U>>(obj: T, table: string, row: string, column: string, value: U): T {
  const prev = getDeep(obj, table, row, column);
  if (prev === value) {
    return obj;
  }
  if (obj[table] === undefined) {
    return {
      ...obj,
      [table]: { [row]: { [column]: value } },
    };
  }
  if (obj[table][row] === undefined) {
    return {
      ...obj,
      [table]: {
        ...obj[table],
        [row]: { [column]: value },
      },
    };
  }
  return {
    ...obj,
    [table]: {
      ...obj[table],
      [row]: {
        ...obj[table][row],
        [column]: value,
      },
    },
  };
}

function setDeepMutate<U>(obj: DeepObj<U>, table: string, row: string, column: string, value: U) {
  obj[table] = obj[table] || {};
  obj[table][row] = obj[table][row] || {};
  obj[table][row][column] = value;
}
