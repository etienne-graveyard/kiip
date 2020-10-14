import { KiipSchema, SyncData, KiipDocument, KiipDatabase, KiipDocumentState } from './types';
import { KiipDocumentStore, createKiipDocumentStore } from './KiipDocumentStore';
import { DONE_TOKEN, createId, checkId } from './utils';
import { Unsubscribe, SubscriptionCallback } from 'suub';

export interface Kiip<Schema extends KiipSchema, Metadata> {
  getDocuments: () => Promise<Array<KiipDocument<Metadata>>>;
  subscribeDocuments: (callback: SubscriptionCallback<Array<KiipDocument<Metadata>>>) => Unsubscribe;
  getDocumentState: (documentId: string) => Promise<KiipDocumentState<Schema, Metadata>>;
  getDocumentStore: (documentId: string) => Promise<KiipDocumentStore<Schema, Metadata>>;
  createDocument: (documentId?: string) => Promise<KiipDocumentState<Schema, Metadata>>;
  insert<K extends keyof Schema>(documentId: string, table: K, doc: Schema[K]): Promise<string>;
  update<K extends keyof Schema>(documentId: string, table: K, id: string, doc: Partial<Schema[K]>): Promise<void>;
  setMeta: (documentId: string, meta: Metadata) => Promise<void>;
  prepareSync(documentId: string): Promise<SyncData>;
  handleSync(documentId: string, data: SyncData): Promise<SyncData>;
}

export interface KiipOptions<Metadata> {
  getInitialMetadata: () => Metadata;
}

export function Kiip<Schema extends KiipSchema, Metadata>(
  database: KiipDatabase<any>,
  options: KiipOptions<Metadata>
): Kiip<Schema, Metadata> {
  const { getInitialMetadata } = options;
  const stores: { [docId: string]: KiipDocumentStore<Schema, Metadata> } = {};

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
    setMeta,
  };

  function subscribeDocuments(callback: SubscriptionCallback<Array<KiipDocument<Metadata>>>): Unsubscribe {
    return database.subscribeDocuments(callback as any);
  }

  async function getDocuments(): Promise<Array<KiipDocument<Metadata>>> {
    return database.withTransaction((tx, resolve, reject) => {
      return database.getDocuments(
        tx,
        (docs) => {
          return resolve(docs as Array<KiipDocument<Metadata>>);
        },
        reject
      );
    });
  }

  async function createDocument(docId?: string): Promise<KiipDocumentState<Schema, Metadata>> {
    const documentId = docId === undefined ? createId() : checkId(docId);
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
    return database.withTransaction((tx, resolve, reject) => {
      return getOrCreateDocumentStore(tx, documentId, resolve, reject);
    });
  }

  async function getDocumentState(documentId: string): Promise<KiipDocumentState<Schema, Metadata>> {
    const store = await getDocumentStore(documentId);
    return store.getState();
  }

  // return current markle
  async function prepareSync(documentId: string): Promise<SyncData> {
    return database.withTransaction((tx, resolve, reject) => {
      return database.getDocument(
        tx,
        documentId,
        (doc) => {
          if (!doc) {
            console.warn(`cannot find document ${documentId}`);
            throw new Error(`Document not found`);
          }
          return getOrCreateDocumentStore(
            tx,
            documentId,
            (store) => {
              return resolve(store.prepareSync());
            },
            reject
          );
        },
        reject
      );
    });
  }

  // get remote merkle tree and return fragments
  async function handleSync(documentId: string, data: SyncData): Promise<SyncData> {
    const store = await database.withTransaction<KiipDocumentStore<Schema, Metadata>>((tx, resolve, reject) => {
      return database.getDocument(
        tx,
        documentId,
        (doc) => {
          if (!doc) {
            console.warn(`cannot find document ${documentId}`);
            throw new Error(`Document not found`);
          }
          return getOrCreateDocumentStore(
            tx,
            doc.id,
            (store) => {
              return resolve(store);
            },
            reject
          );
        },
        reject
      );
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
    onResolve: (facade: KiipDocumentStore<Schema, Metadata>) => DONE_TOKEN,
    onReject: (error: any) => DONE_TOKEN
  ): DONE_TOKEN {
    const store = stores[documentId];
    if (store) {
      return onResolve(store);
    }
    return database.getDocument(
      tx,
      documentId,
      (doc) => {
        if (doc) {
          return createStore(doc as KiipDocument<Metadata>, onResolve, onReject);
        }
        const nodeId = createId();
        // create doc
        const newDoc = (doc = {
          id: documentId,
          nodeId,
          meta: getInitialMetadata(),
        });
        return database.addDocument(tx, newDoc, () => createStore(newDoc, onResolve, onReject), onReject);
      },
      onReject
    );

    function createStore(
      doc: KiipDocument<Metadata>,
      onResolve: (store: KiipDocumentStore<Schema, Metadata>) => DONE_TOKEN,
      onReject: (error: any) => DONE_TOKEN
    ): DONE_TOKEN {
      return createKiipDocumentStore<Schema, Metadata>(
        tx,
        doc,
        database,
        (store) => {
          // keep in cache
          stores[doc.id] = store;
          return onResolve(store);
        },
        onReject,
        () => unmountStore(doc.id)
      );
    }
  }
}
