import { KiipFragment, KiipSchema, KiipDocumentState, KiipDatabase, SyncData, KiipDocument } from './types';
import { Clock } from './Clock';
import { Timestamp } from './Timestamp';
import { MerkleTree } from './MerkleTree';
import { Subscription, SubscribeMethod } from 'suub';
import { nanoid } from 'nanoid';
import { DONE_TOKEN } from './utils';

// latest timestamp for each table-row-column
interface Latest {
  [table: string]: { [row: string]: { [column: string]: string } };
}

export interface KiipDocumentStore<Schema extends KiipSchema, Metadata> {
  prepareSync(): SyncData;
  handleSync(data: SyncData): Promise<SyncData>;
  subscribe: SubscribeMethod<KiipDocumentState<Schema, Metadata>>;
  getState: () => KiipDocumentState<Schema, Metadata>;
  insert<K extends keyof Schema>(table: K, doc: Schema[K]): Promise<string>;
  update<K extends keyof Schema>(table: K, id: string, doc: Partial<Schema[K]>): Promise<void>;
  setMeta: (meta: Metadata) => Promise<void>;
}

export function KiipDocumentStore<Schema extends KiipSchema, Metadata>(
  tx: unknown,
  document: KiipDocument<Metadata>,
  database: KiipDatabase<unknown>,
  onResolve: (store: KiipDocumentStore<Schema, Metadata>) => DONE_TOKEN,
  keepAlive: number | true,
  onUnmount: () => void
): DONE_TOKEN {
  const clock = new Clock(document.nodeId);
  let state: KiipDocumentState<Schema, Metadata> = {
    meta: document.meta,
    data: {} as any
  };
  const latest: Latest = {};
  const sub = Subscription({
    onFirstSubscription: () => {
      cancelUnmount();
    },
    onLastUnsubscribe: () => {
      scheduleUnmount();
    }
  }) as Subscription<KiipDocumentState<Schema, Metadata>>;

  let unmountTimer: NodeJS.Timer | null = null;

  // on mount => schedule unmount (might be juste a getState)
  scheduleUnmount();

  // apply all fragments
  return database.onEachFragment(
    tx,
    document.id,
    fragment => {
      handleFragments([fragment], 'init');
    },
    () => {
      return onResolve({
        prepareSync,
        handleSync,
        subscribe: sub.subscribe,
        getState,
        insert,
        update,
        setMeta
      });
    }
  );

  function scheduleUnmount() {
    if (keepAlive !== true) {
      unmountTimer = setTimeout(onUnmount, keepAlive);
    }
  }

  function cancelUnmount() {
    if (unmountTimer !== null) {
      clearTimeout(unmountTimer);
    }
  }

  async function setMeta(newMeta: Metadata): Promise<void> {
    return database.withTransaction((tx, done) => {
      return database.setMetadata(tx, document.id, newMeta, () => {
        state = { ...state, meta: newMeta };
        sub.emit(state);
        return done();
      });
    });
  }

  function getState(): KiipDocumentState<Schema, Metadata> {
    return state as any;
  }

  async function insert<K extends keyof Schema>(table: K, data: Schema[K]): Promise<string> {
    const rowId = nanoid(16);
    const fragments: Array<KiipFragment> = Object.keys(data).map(column => ({
      timestamp: clock.send().toString(),
      documentId: document.id,
      table: table as string,
      column,
      row: rowId,
      value: data[column]
    }));
    return database.withTransaction((tx, done) => {
      return database.addFragments(tx, fragments, () => {
        handleFragments(fragments, 'update');
        return done(rowId);
      });
    });
  }

  async function update<K extends keyof Schema>(table: K, id: string, data: Partial<Schema[K]>): Promise<void> {
    const fragments: Array<KiipFragment> = Object.keys(data).map(column => ({
      timestamp: clock.send().toString(),
      documentId: document.id,
      table: table as string,
      column,
      row: id,
      value: data[column]
    }));
    return database.withTransaction((tx, done) => {
      return database.addFragments(tx, fragments, () => {
        handleFragments(fragments, 'update');
        return done();
      });
    });
  }

  // return current markle
  function prepareSync(): SyncData {
    return {
      nodeId: clock.node,
      merkle: clock.merkle,
      // we are sending the merkle tree so we don't have fragments to send
      fragments: []
    };
  }

  // get remote merkle tree and return fragments
  async function handleSync(data: SyncData): Promise<SyncData> {
    return database.withTransaction((tx, done) => {
      return database.addFragments(tx, data.fragments, () => {
        handleFragments(data.fragments, 'update');
        // then compute response
        const diffTime = MerkleTree.diff(clock.merkle, data.merkle);
        if (diffTime === null) {
          return done({
            nodeId: clock.node,
            merkle: clock.merkle,
            fragments: []
          });
        }
        let timestamp = new Timestamp(diffTime, 0, '0');
        return database.getFragmentsSince(tx, document.id, timestamp, data.nodeId, fragments => {
          return done({
            nodeId: clock.node,
            merkle: clock.merkle,
            fragments
          });
        });
      });
    });
  }

  function handleFragments(fragments: Array<KiipFragment>, mode: 'init' | 'update') {
    const prevState = state;
    fragments.forEach(fragment => {
      clock.recv(Timestamp.parse(fragment.timestamp));
      applyFragmentOnState(fragment, mode);
    });
    if (state !== prevState && mode === 'update') {
      sub.emit(state as any);
    }
  }

  function applyFragmentOnState(fragment: KiipFragment, mode: 'init' | 'update') {
    const { column, table, row, timestamp, value } = fragment;
    const latestTable = latest[table] || {};
    const latestRow = latestTable[row] || {};
    const latestTs = latestRow[column];
    if (latestTs === undefined || latestTs < timestamp) {
      const prevData = state.data;
      if (mode === 'update') {
        const nextData = setDeep(prevData, table, row, column, value);
        if (nextData !== prevData) {
          state = {
            ...state,
            data: nextData
          };
        }
      } else {
        setDeepMutate(state.data, table, row, column, timestamp);
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
      [table]: { [row]: { [column]: value } }
    };
  }
  if (obj[table][row] === undefined) {
    return {
      ...obj,
      [table]: {
        ...obj[table],
        [row]: { [column]: value }
      }
    };
  }
  return {
    ...obj,
    [table]: {
      ...obj[table],
      [row]: {
        ...obj[table][row],
        [column]: value
      }
    }
  };
}

function setDeepMutate<U>(obj: DeepObj<U>, table: string, row: string, column: string, value: U) {
  obj[table] = obj[table] || {};
  obj[table][row] = obj[table][row] || {};
  obj[table][row][column] = value;
}
