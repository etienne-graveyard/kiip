import {
  KiipDatabase,
  KiipFragment,
  KiipDocument,
  Timestamp,
  createKiipPromise,
  kiipCallbackFromAsync,
} from '@kiip/core';
import { openDB, DBSchema, IDBPTransaction } from 'idb';
import { Subscription } from 'suub';

export interface BackendDB extends DBSchema {
  fragments: {
    value: KiipFragment;
    key: string;
    indexes: {
      byDocument: string;
    };
  };
  documents: {
    key: string;
    value: KiipDocument<unknown>;
  };
}

export type BackendTransaction = IDBPTransaction<BackendDB, ['documents', 'fragments']>;

export async function KiipIndexedDB(dbName: string): Promise<KiipDatabase<BackendTransaction>> {
  const db = await openDB<BackendDB>(dbName, 1, {
    upgrade(db) {
      db.createObjectStore('documents', {
        keyPath: 'id',
      });

      const fragmetsStore = db.createObjectStore('fragments', {
        keyPath: ['documentId', 'timestamp'],
      });
      fragmetsStore.createIndex('byDocument', 'documentId');
    },
  });

  const documentsSub = Subscription<Array<KiipDocument<unknown>>>();
  const documentSub = Subscription<KiipDocument<unknown>>();

  const documentsChannel = new BroadcastChannel(`KIIP_DOCUMENTS_${dbName}`);
  documentsChannel.addEventListener('message', (e) => {
    documentsSub.emit(e.data);
  });

  const documentChannel = new BroadcastChannel(`KIIP_DOCUMENT_${dbName}`);
  documentChannel.addEventListener('message', (e) => {
    documentSub.emit(e.data);
  });

  return {
    subscribeDocuments(callback) {
      return documentsSub.subscribe(callback);
    },
    subscribeDocument(documentId, callback) {
      return documentSub.subscribe((doc) => {
        if (doc.id === documentId) {
          callback(doc);
        }
      });
    },
    withTransaction(exec) {
      return createKiipPromise((resolve) => {
        const tx: BackendTransaction = db.transaction(['documents', 'fragments'], 'readwrite');
        return exec(tx, (val) => {
          return kiipCallbackFromAsync(async () => {
            await tx.done;
            return val;
          }, resolve);
        });
      });
    },
    onEachFragment(tx, documentId, onFragment, onResolve) {
      return kiipCallbackFromAsync(async () => {
        const fragmentsStore = tx.objectStore('fragments');
        let cursor = await fragmentsStore.index('byDocument').openCursor(documentId);
        if (!cursor) {
          return;
        }
        while (cursor) {
          const fragment = cursor.value;
          onFragment(fragment);
          cursor = await cursor.continue();
        }
      }, onResolve);
    },
    getFragmentsSince(tx, documentId, timestamp, skipNodeId, onResolve) {
      return kiipCallbackFromAsync(async () => {
        const fragmentsStore = tx.objectStore('fragments');
        // find all message after timestamp except the ones emitted by skipNodeId
        let cursor = await fragmentsStore.index('byDocument').openCursor(documentId);
        if (!cursor) {
          return [];
        }
        const fragments: Array<KiipFragment> = [];
        while (cursor) {
          const ts = Timestamp.parse(cursor.value.timestamp);
          if (timestamp <= ts && ts.node !== skipNodeId) {
            fragments.push(cursor.value);
          }
          cursor = await cursor.continue();
        }
        return fragments;
      }, onResolve);
    },
    getDocuments(tx, onResolve) {
      return kiipCallbackFromAsync(async () => {
        const docsStore = tx.objectStore('documents');
        const docs = await docsStore.getAll();
        return docs;
      }, onResolve);
    },
    getDocument(tx, documentId, onResolve) {
      return kiipCallbackFromAsync(async () => {
        const doc = await tx.objectStore('documents').get(documentId);
        if (!doc) {
          return;
        }
        return doc;
      }, onResolve);
    },
    addFragments(tx, fragments, onResolve) {
      return kiipCallbackFromAsync(async () => {
        const fragmentsStore = tx.objectStore('fragments');
        for await (const fragment of fragments) {
          await fragmentsStore.add(fragment);
        }
      }, onResolve);
    },
    addDocument(tx, document, onResolve) {
      return kiipCallbackFromAsync(async () => {
        const docsStore = tx.objectStore('documents');
        await docsStore.add(document);
        const docs = await docsStore.getAll();
        documentsSub.emit(docs);
        documentsChannel.postMessage(docs);
      }, onResolve);
    },
    setMetadata(tx, documentId, meta, onResolve) {
      return kiipCallbackFromAsync(async () => {
        const doc = await tx.objectStore('documents').get(documentId);
        if (!doc) {
          throw new Error(`Cannot find document ${documentId}`);
        }
        await tx.objectStore('documents').put({
          ...doc,
          meta,
        });
        const docs = await tx.objectStore('documents').getAll();
        documentsSub.emit(docs);
        documentsChannel.postMessage(docs);
        documentSub.emit(doc);
        documentChannel.postMessage(doc);
      }, onResolve);
    },
  };
}
