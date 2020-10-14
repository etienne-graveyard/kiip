import { Subscription } from 'suub';
import { KiipDatabase, KiipDocument, KiipFragment } from './types';
import { createKiipCallbackSync, createKiipPromise } from './utils';

export type Transaction = null;

export function KiipMemoryDb(): KiipDatabase<Transaction> {
  let db: {
    fragments: Array<KiipFragment>;
    documents: Array<KiipDocument<unknown>>;
  } = {
    fragments: [],
    documents: [],
  };

  const documentsSub = Subscription<Array<KiipDocument<unknown>>>();
  const documentSub = Subscription<KiipDocument<unknown>>();

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
      return createKiipPromise((resolve, reject) => {
        return exec(null, resolve, reject);
      });
    },
    addDocument(_tx, document, onResolve, onReject) {
      return createKiipCallbackSync(
        () => {
          db = {
            ...db,
            documents: [...db.documents, document],
          };
          documentsSub.emit(db.documents);
        },
        onResolve,
        onReject
      );
    },
    addFragments(_tx, fragments, onResolve, onReject) {
      return createKiipCallbackSync(
        () => {
          db.fragments.push(...fragments);
        },
        onResolve,
        onReject
      );
    },
    getDocument(_, documentId, onResolve, onReject) {
      return createKiipCallbackSync(
        () => {
          const doc = db.documents.find((doc) => doc.id === documentId);
          if (!doc) {
            return;
          }
          return doc;
        },
        onResolve,
        onReject
      );
    },
    getDocuments(_, onResolve, onReject) {
      return createKiipCallbackSync(
        () => {
          return db.documents;
        },
        onResolve,
        onReject
      );
    },
    getFragmentsSince(_, documentId, timestamp, skipNodeId, onResolve, onReject) {
      return createKiipCallbackSync(
        () => {
          const tsStr = timestamp.toString();
          const frags: Array<KiipFragment> = [];
          db.fragments.forEach((frag) => {
            if (frag.documentId !== documentId) {
              return;
            }
            if (frag.timestamp.endsWith(skipNodeId)) {
              return;
            }
            if (frag.timestamp > tsStr) {
              frags.push(frag);
            }
          });
          return frags;
        },
        onResolve,
        onReject
      );
    },
    onEachFragment(_, documentId, onFragment, onResolve, onReject) {
      return createKiipCallbackSync(
        () => {
          const frags = db.fragments.filter((frag) => frag.documentId === documentId);
          frags.forEach((frag) => {
            onFragment(frag);
          });
        },
        onResolve,
        onReject
      );
    },
    setMetadata(_, documentId, meta, onResolve, onReject) {
      return createKiipCallbackSync(
        () => {
          db = {
            ...db,
            documents: db.documents.map((doc) => {
              if (doc.id !== documentId) {
                return doc;
              }
              return {
                ...doc,
                meta,
              };
            }),
          };
          const newDoc = db.documents.find((doc) => doc.id === documentId);
          if (newDoc) {
            documentSub.emit(newDoc);
          }
          documentsSub.emit(db.documents);
        },
        onResolve,
        onReject
      );
    },
  };
}
