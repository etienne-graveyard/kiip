import { KiipDatabase, createKiipCallbackSync, createKiipPromise, KiipDocument } from '@kiip/core';
import Database, { Options } from 'better-sqlite3';
import { Subscription } from 'suub';

export type Transaction = null;

interface DatabaseFragment {
  document_id: string;
  timestamp: string;
  table_name: string;
  row: string;
  column: string;
  value: string;
}

interface DatabaseDocument {
  id: string;
  node_id: string;
  meta: string;
}

export function KiipSQLite(path: string, options: Options = {}): KiipDatabase<Transaction> {
  const db = new Database(path, {
    ...options,
    readonly: false,
  });

  db.prepare(
    `CREATE TABLE IF NOT EXISTS fragments (
      document_id TEXT,
      timestamp TEXT,
      table_name TEXT,
      row TEXT,
      column TEXT,
      value TEXT,
      PRIMARY KEY(timestamp, document_id)
    )`
  ).run();
  db.prepare(
    `CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      node_id TEXT,
      meta TEXT
    )`
  ).run();

  const insertFragmentQuery = db.prepare<DatabaseFragment>(
    `INSERT INTO fragments (document_id, timestamp, table_name, row, column, value)
     VALUES (@document_id, @timestamp, @table_name, @row, @column, @value)`
  );

  const beginQuery = db.prepare('BEGIN');

  const commitQuery = db.prepare('COMMIT');

  const insertDocumentQuery = db.prepare<DatabaseDocument>(
    `INSERT INTO documents (id, node_id, meta)
     VALUES (@id, @node_id, @meta)`
  );

  const findDocumentQuery = db.prepare<string>(`SELECT * FROM documents WHERE id = ?`);

  const findDocumentsQuery = db.prepare(`SELECT * FROM documents`);

  const findFragmentSinceQuery = db.prepare<{
    document_id: string;
    timestamp: string;
    ignore_node: string;
  }>(
    `SELECT * FROM fragments WHERE document_id = @document_id AND timestamp > @timestamp AND timestamp NOT LIKE '%' || @ignore_node ORDER BY timestamp`
  );

  const findAllFragmentQuery = db.prepare<{ document_id: string }>(
    `SELECT * FROM fragments WHERE document_id = @document_id ORDER BY timestamp`
  );

  const setMetaQuery = db.prepare<{ document_id: string; meta: string }>(
    `UPDATE documents
     SET meta = @meta
     WHERE id = @document_id LIMIT 1`
  );

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
        beginQuery.run();
        return exec(
          null,
          (val) => {
            commitQuery.run();
            return resolve(val);
          },
          reject
        );
      });
    },
    addDocument(_tx, document, onResolve, onReject) {
      return createKiipCallbackSync(
        () => {
          insertDocumentQuery.run({
            id: document.id,
            node_id: document.nodeId,
            meta: serializeValue(document.meta),
          });
          const docs: Array<DatabaseDocument> = findDocumentsQuery.all();
          const allDocs = docs.map((doc) => ({
            id: doc.id,
            nodeId: doc.node_id,
            meta: deserializeValue(doc.meta),
          }));
          documentsSub.emit(allDocs);
        },
        onResolve,
        onReject
      );
    },
    addFragments(_tx, fragments, onResolve, onReject) {
      return createKiipCallbackSync(
        () => {
          fragments.forEach((fragment) => {
            insertFragmentQuery.run({
              document_id: fragment.documentId,
              timestamp: fragment.timestamp,
              table_name: fragment.table,
              row: fragment.row,
              column: fragment.column,
              value: serializeValue(fragment.value),
            });
          });
        },
        onResolve,
        onReject
      );
    },
    getDocument(_, documentId, onResolve, onReject) {
      return createKiipCallbackSync(
        () => {
          const doc: DatabaseDocument = findDocumentQuery.get(documentId);
          if (!doc) {
            return;
          }
          return {
            id: doc.id,
            nodeId: doc.node_id,
            meta: deserializeValue(doc.meta),
          };
        },
        onResolve,
        onReject
      );
    },
    getDocuments(_, onResolve, onReject) {
      return createKiipCallbackSync(
        () => {
          const docs: Array<DatabaseDocument> = findDocumentsQuery.all();
          return docs.map((doc) => ({
            id: doc.id,
            nodeId: doc.node_id,
            meta: deserializeValue(doc.meta),
          }));
        },
        onResolve,
        onReject
      );
    },
    getFragmentsSince(_, documentId, timestamp, skipNodeId, onResolve, onReject) {
      return createKiipCallbackSync(
        () => {
          const frags: Array<DatabaseFragment> = findFragmentSinceQuery.all({
            document_id: documentId,
            ignore_node: skipNodeId,
            timestamp: timestamp.toString(),
          });
          return frags.map(({ column, document_id, row, table_name, timestamp, value }) => ({
            documentId: document_id,
            timestamp,
            table: table_name,
            column,
            row,
            value: deserializeValue(value),
          }));
        },
        onResolve,
        onReject
      );
    },
    onEachFragment(_, documentId, onFragment, onResolve, onReject) {
      return createKiipCallbackSync(
        () => {
          const frags = findAllFragmentQuery.iterate({ document_id: documentId });
          let result = frags.next();
          while (!result.done) {
            const { column, document_id, row, table_name, timestamp, value }: DatabaseFragment = result.value;
            onFragment({
              documentId: document_id,
              timestamp,
              table: table_name,
              column,
              row,
              value: deserializeValue(value),
            });
            result = frags.next();
          }
        },
        onResolve,
        onReject
      );
    },
    setMetadata(_, documentId, meta, onResolve, onReject) {
      return createKiipCallbackSync(
        () => {
          setMetaQuery.run({ document_id: documentId, meta: serializeValue(meta) });
          const doc: DatabaseDocument = findDocumentQuery.get(documentId);
          documentSub.emit({
            id: doc.id,
            nodeId: doc.node_id,
            meta: deserializeValue(doc.meta),
          });
          const docs: Array<DatabaseDocument> = findDocumentsQuery.all();
          const allDocs = docs.map((doc) => ({
            id: doc.id,
            nodeId: doc.node_id,
            meta: deserializeValue(doc.meta),
          }));
          documentsSub.emit(allDocs);
        },
        onResolve,
        onReject
      );
    },
  };
}

function serializeValue(value: any): string {
  return JSON.stringify({ value });
}

function deserializeValue(value: string): any {
  return JSON.parse(value).value;
}
