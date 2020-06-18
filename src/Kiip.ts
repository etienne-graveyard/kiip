import { KiipSchema, SyncData, KiipDocument, KiipDocumentFacade, KiipDocumentInternal, KiipDatabase } from './types';
import { KiipDocumentStore } from './KiipDocumentStore';
import { nanoid } from 'nanoid';
import { DONE_TOKEN } from './utils';

export interface Kiip<Schema extends KiipSchema> {
  prepareSync: (documentId: string) => Promise<SyncData>;
  handleSync: (documentId: string, data: SyncData) => Promise<SyncData>;
  getDocuments: () => Promise<Array<KiipDocument>>;
  getDocument: (documentId: string) => Promise<KiipDocumentFacade<Schema>>;
  createDocument: () => Promise<KiipDocumentFacade<Schema>>;
}

export function Kiip<Schema extends KiipSchema, Transaction>(database: KiipDatabase<Transaction>): Kiip<Schema> {
  const stores: { [docId: string]: KiipDocumentStore<Schema, Transaction> } = {};

  return {
    prepareSync,
    handleSync,
    getDocuments,
    getDocument,
    createDocument
  };

  async function getDocuments(): Promise<Array<{ id: string; name: string }>> {
    return database.withTransaction((tx, done) => {
      return database.getDocuments(tx, docs => {
        return done(docs.map(doc => ({ id: doc.id, name: doc.name })));
      });
    });
  }

  async function createDocument(): Promise<KiipDocumentFacade<Schema>> {
    const documentId = nanoid();
    return getDocument(documentId);
  }

  async function getDocument(documentId: string): Promise<KiipDocumentFacade<Schema>> {
    return database.withTransaction((tx, done) => {
      return getDocumentStore(tx, documentId, ({ getState, insert, subscribe, update }) => {
        return done({
          id: documentId,
          handleSync: data => handleSync(documentId, data),
          prepareSync: () => prepareSync(documentId),
          getState,
          insert,
          subscribe,
          update
        });
      });
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
        return getDocumentStore(tx, documentId, store => {
          return done(store.prepareSync());
        });
      });
    });
  }

  // get remote merkle tree and return fragments
  async function handleSync(documentId: string, data: SyncData): Promise<SyncData> {
    const store = await database.withTransaction<KiipDocumentStore<Schema, Transaction>>((tx, done) => {
      return database.getDocument(tx, documentId, doc => {
        if (!doc) {
          console.warn(`cannot find document ${documentId}`);
          throw new Error(`Document not found`);
        }
        return getDocumentStore(tx, doc.id, store => {
          return done(store);
        });
      });
    });
    return store.handleSync(data);
  }

  function getDocumentStore(
    tx: Transaction,
    documentId: string,
    onResolve: (store: KiipDocumentStore<Schema, Transaction>) => DONE_TOKEN
  ): DONE_TOKEN {
    const store = stores[documentId];
    if (store) {
      return onResolve(store);
    }
    return database.getDocument(tx, documentId, doc => {
      if (doc) {
        return createStore(doc, onResolve);
      }
      const nodeId = nanoid(16);
      // create doc
      doc = {
        id: documentId,
        nodeId,
        name: documentId
      };
      return database.addDocument(tx, doc, () => {
        return createStore(doc, onResolve);
      });
    });

    function createStore(
      doc: KiipDocumentInternal,
      onResolve: (store: KiipDocumentStore<Schema, Transaction>) => DONE_TOKEN
    ): DONE_TOKEN {
      return KiipDocumentStore<Schema, Transaction>(tx, doc.id, doc.nodeId, database, store => {
        // keep in cache
        stores[documentId] = store;
        return onResolve(store);
      });
    }
  }
}
