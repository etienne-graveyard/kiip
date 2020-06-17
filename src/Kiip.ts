import {
  KiipSchema,
  SyncData,
  KiipDocument,
  KiipDocumentFacade,
  KiipFragment,
  KiipDocumentInternal,
  KiipDatabase,
} from './types';
import { KiipDocumentStore } from './KiipDocumentStore';
import { nanoid } from 'nanoid';

export interface Kiip<Schema extends KiipSchema> {
  prepareSync: (documentId: string) => Promise<SyncData>;
  handleSync: (documentId: string, data: SyncData) => Promise<SyncData>;
  getDocuments: () => Promise<Array<KiipDocument>>;
  getDocument: (documentId: string) => Promise<KiipDocumentFacade<Schema>>;
  createDocument: () => Promise<KiipDocumentFacade<Schema>>;
}

export function Kiip<Schema extends KiipSchema, Transaction>(
  database: KiipDatabase<Transaction>
): Kiip<Schema> {
  const stores: { [docId: string]: KiipDocumentStore<Schema, Transaction> } = {};

  return {
    prepareSync,
    handleSync,
    getDocuments,
    getDocument,
    createDocument,
  };

  async function addFragmentsWithTransaction(fragments: Array<KiipFragment>): Promise<void> {
    return database.withTransaction(async (tx) => {
      database.addFragments(tx, fragments);
    });
  }

  async function getDocuments(): Promise<Array<{ id: string; name: string }>> {
    return database.withTransaction(async (tx) => {
      const docs = await database.getDocuments(tx);
      return docs.map((doc) => ({ id: doc.id, name: doc.name }));
    });
  }

  async function createDocument(): Promise<KiipDocumentFacade<Schema>> {
    const documentId = nanoid();
    return getDocument(documentId);
  }

  async function getDocument(documentId: string): Promise<KiipDocumentFacade<Schema>> {
    return database.withTransaction(async (tx) => {
      const { getState, insert, subscribe, update } = await getDocumentStore(tx, documentId);
      return {
        id: documentId,
        handleSync: (data) => handleSync(documentId, data),
        prepareSync: () => prepareSync(documentId),
        getState,
        insert,
        subscribe,
        update,
      };
    });
  }

  // return current markle
  async function prepareSync(documentId: string): Promise<SyncData> {
    return database.withTransaction(async (tx) => {
      let doc = await database.getDocument(tx, documentId);
      if (!doc) {
        console.warn(`cannot find document ${documentId}`);
        throw new Error(`Document not found`);
      }
      const store = await getDocumentStore(tx, documentId);
      return store.prepareSync();
    });
  }

  // get remote merkle tree and return fragments
  async function handleSync(documentId: string, data: SyncData): Promise<SyncData> {
    const store = await database.withTransaction(async (tx) => {
      let doc = await database.getDocument(tx, documentId);
      if (!doc) {
        console.warn(`cannot find document ${documentId}`);
        throw new Error(`Document not found`);
      }
      // first apply fragments
      const store = await getDocumentStore(tx, doc.id);
      return store;
    });
    return store.handleSync(data);
  }

  async function getDocumentStore(
    tx: Transaction,
    documentId: string
  ): Promise<KiipDocumentStore<Schema, Transaction>> {
    const store = stores[documentId];
    if (store) {
      return store;
    }
    let doc = await database.getDocument(tx, documentId);
    if (!doc) {
      const nodeId = nanoid(16);
      // create doc
      doc = {
        id: documentId,
        nodeId,
        name: documentId,
      };
      await database.addDocument(tx, doc);
    }
    const newStore = await KiipDocumentStore<Schema, Transaction>(tx, doc.id, doc.nodeId, database);
    // keep in cache
    stores[documentId] = newStore;
    return newStore;
  }
}
