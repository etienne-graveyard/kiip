import { KiipSchema, SyncData, KiipDocumentFacade, KiipDocument, KiipDatabase } from './types';
import { KiipDocumentStore } from './KiipDocumentStore';
import { nanoid } from 'nanoid';
import { DONE_TOKEN } from './utils';

export interface Kiip<Schema extends KiipSchema, Metadata> {
  getDocuments: () => Promise<Array<KiipDocument<Metadata>>>;
  getDocument: (documentId: string) => Promise<KiipDocumentFacade<Schema, Metadata>>;
  createDocument: () => Promise<KiipDocumentFacade<Schema, Metadata>>;
}

export interface KiipOptions<Metadata> {
  getInitialMetadata: () => Metadata;
  keepAlive?: number;
}

export function Kiip<Schema extends KiipSchema, Transaction, Metadata>(
  database: KiipDatabase<Transaction, Metadata>,
  options: KiipOptions<Metadata>
): Kiip<Schema, Metadata> {
  const { getInitialMetadata, keepAlive = 3000 } = options;
  const stores: { [docId: string]: KiipDocumentStore<Schema, Metadata> } = {};

  return {
    getDocuments,
    getDocument,
    createDocument
  };

  async function getDocuments(): Promise<Array<KiipDocument<Metadata>>> {
    return database.withTransaction((tx, done) => {
      return database.getDocuments(tx, docs => {
        return done(docs);
      });
    });
  }

  async function createDocument(): Promise<KiipDocumentFacade<Schema, Metadata>> {
    const documentId = nanoid();
    return getDocument(documentId);
  }

  async function getDocument(documentId: string): Promise<KiipDocumentFacade<Schema, Metadata>> {
    return database.withTransaction((tx, done) => {
      return getDocumentStore(tx, documentId, ({ getState, insert, subscribe, update, setMeta }) => {
        return done({
          id: documentId,
          handleSync: data => handleSync(documentId, data),
          prepareSync: () => prepareSync(documentId),
          getState,
          insert,
          subscribe,
          update,
          setMeta
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
    const store = await database.withTransaction<KiipDocumentStore<Schema, Metadata>>((tx, done) => {
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

  function unmountStore(documentId: string) {
    if (stores[documentId]) {
      delete stores[documentId];
    }
  }

  function getDocumentStore(
    tx: Transaction,
    documentId: string,
    onResolve: (store: KiipDocumentStore<Schema, Metadata>) => DONE_TOKEN
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
        meta: getInitialMetadata()
      };
      return database.addDocument(tx, doc, () => {
        return createStore(doc, onResolve);
      });
    });

    function createStore(
      doc: KiipDocument<Metadata>,
      onResolve: (store: KiipDocumentStore<Schema, Metadata>) => DONE_TOKEN
    ): DONE_TOKEN {
      return KiipDocumentStore<Schema, Transaction, Metadata>(
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
