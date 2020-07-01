import { KiipSchema, SyncData, KiipDocument, KiipDatabase, KiipDocumentState } from './types';
import { KiipDocumentStore } from './KiipDocumentStore';
import { nanoid } from 'nanoid';
import { DONE_TOKEN } from './utils';
import { Subscription, OnUnsubscribed, Unsubscribe, SubscriptionCallback } from 'suub';

export interface Kiip<Schema extends KiipSchema, Metadata> {
  getDocuments: () => Promise<Array<KiipDocument<Metadata>>>;
  subscribeDocuments: (callback: SubscriptionCallback<Array<KiipDocument<Metadata>>>) => Unsubscribe;
  getDocumentState: (documentId: string) => Promise<KiipDocumentState<Schema, Metadata>>;
  getDocumentStore: (documentId: string) => Promise<KiipDocumentStore<Schema, Metadata>>;
  createDocument: () => Promise<KiipDocumentState<Schema, Metadata>>;
  insert<K extends keyof Schema>(documentId: string, table: K, doc: Schema[K]): Promise<string>;
  update<K extends keyof Schema>(documentId: string, table: K, id: string, doc: Partial<Schema[K]>): Promise<void>;
  setMeta: (documentId: string, meta: Metadata) => Promise<void>;
  prepareSync(documentId: string): Promise<SyncData>;
  handleSync(documentId: string, data: SyncData): Promise<SyncData>;
}

export interface KiipOptions<Metadata> {
  getInitialMetadata: () => Metadata;
  keepAlive?: number | true;
}

export function Kiip<Schema extends KiipSchema, Metadata>(
  database: KiipDatabase<any>,
  options: KiipOptions<Metadata>
): Kiip<Schema, Metadata> {
  const { getInitialMetadata, keepAlive = 3000 } = options;
  const stores: { [docId: string]: KiipDocumentStore<Schema, Metadata> } = {};

  const documentsSub = Subscription() as Subscription<Array<KiipDocument<Metadata>>>;

  return {
    getDocuments,
    subscribeDocuments,
    getDocumentState,
    getDocumentStore,
    createDocument,
    prepareSync,
    handleSync,
    insert,
    update,
    setMeta
  };

  function subscribeDocuments(callback: SubscriptionCallback<Array<KiipDocument<Metadata>>>): Unsubscribe {
    return database.subscribeDocuments(callback as any);
  }

  async function getDocuments(): Promise<Array<KiipDocument<Metadata>>> {
    return database.withTransaction((tx, done) => {
      return database.getDocuments(tx, docs => {
        return done(docs as Array<KiipDocument<Metadata>>);
      });
    });
  }

  async function getDocumentState(documentId: string): Promise<KiipDocumentState<Schema, Metadata>> {
    const store = await getDocumentStore(documentId);
    return store.getState();
  }

  async function createDocument(): Promise<KiipDocumentState<Schema, Metadata>> {
    const documentId = nanoid();
    const store = await getDocumentStore(documentId);
    return store.getState();
  }

  async function setMeta(documentId: string, meta: Metadata): Promise<void> {
    const store = await getDocumentStore(documentId);
    return store.setMeta(meta);
  }

  async function getDocumentStore(documentId: string): Promise<KiipDocumentStore<Schema, Metadata>> {
    const store = stores[documentId];
    if (store) {
      return store;
    }
    return database.withTransaction((tx, done) => {
      return getOrCreateDocumentStore(tx, documentId, done);
    });
  }

  // return current markle
  async function prepareSync(documentId: string): Promise<SyncData> {
    return database.withTransaction((tx, done) => {
      return database.getDocument(tx, documentId, doc => {
        if (!doc) {
          console.warn(`cannot find document ${documentId}`);
          throw new Error(`Document not found`);
        }
        return getOrCreateDocumentStore(tx, documentId, store => {
          return done(store.prepareSync());
        });
      });
    });
  }

  // get remote merkle tree and return fragments
  async function handleSync(documentId: string, data: SyncData): Promise<SyncData> {
    const store = await database.withTransaction<KiipDocumentStore<Schema, Metadata>>((tx, done) => {
      return database.getDocument(tx, documentId, doc => {
        if (!doc) {
          console.warn(`cannot find document ${documentId}`);
          throw new Error(`Document not found`);
        }
        return getOrCreateDocumentStore(tx, doc.id, store => {
          return done(store);
        });
      });
    });
    return store.handleSync(data);
  }

  function unmountStore(documentId: string) {
    if (stores[documentId]) {
      delete stores[documentId];
    }
  }

  async function insert<K extends keyof Schema>(documentId: string, table: K, doc: Schema[K]): Promise<string> {
    const store = await getDocumentStore(documentId);
    return store.insert(table, doc);
  }

  async function update<K extends keyof Schema>(
    documentId: string,
    table: K,
    id: string,
    doc: Partial<Schema[K]>
  ): Promise<void> {
    const store = await getDocumentStore(documentId);
    return store.update(table, id, doc);
  }

  function getOrCreateDocumentStore(
    tx: unknown,
    documentId: string,
    onResolve: (facade: KiipDocumentStore<Schema, Metadata>) => DONE_TOKEN
  ): DONE_TOKEN {
    const store = stores[documentId];
    if (store) {
      return onResolve(store);
    }
    return database.getDocument(tx, documentId, doc => {
      if (doc) {
        return createStore(doc as KiipDocument<Metadata>, onResolve);
      }
      const nodeId = nanoid(16);
      // create doc
      const newDoc = (doc = {
        id: documentId,
        nodeId,
        meta: getInitialMetadata()
      });
      return database.addDocument(tx, newDoc, () => {
        return createStore(newDoc, onResolve);
      });
    });

    function createStore(
      doc: KiipDocument<Metadata>,
      onResolve: (store: KiipDocumentStore<Schema, Metadata>) => DONE_TOKEN
    ): DONE_TOKEN {
      return KiipDocumentStore<Schema, Metadata>(
        tx,
        doc,
        database,
        store => {
          // keep in cache
          stores[doc.id] = store;
          return onResolve(store);
        },
        keepAlive,
        () => unmountStore(doc.id)
      );
    }
  }
}
