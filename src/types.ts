import { MerkleTree } from './MerkleTree';
import { SubscribeMethod } from 'suub';
import { Timestamp } from './Timestamp';
import { DONE_TOKEN } from './utils';

export interface KiipFragment {
  documentId: string;
  timestamp: string;
  table: string;
  row: string;
  column: string;
  value: any;
}

export interface KiipDocument<Matadata> {
  id: string;
  nodeId: string;
  meta: Matadata;
}

export type KiipSchema = {
  [table: string]: {
    [column: string]: any;
  };
};

export type KiipDocumentData<Schema extends KiipSchema> = {
  [K in keyof Schema]: {
    [row: string]: Schema[K];
  };
};

export interface SyncData {
  nodeId: string;
  fragments: Array<KiipFragment>;
  merkle: MerkleTree;
}

export interface KiipDocumentState<Schema extends KiipSchema, Metadata> {
  id: string;
  data: KiipDocumentData<Schema>;
  meta: Metadata;
}

export interface KiipDocumentFacade<Schema extends KiipSchema, Metadata> {}

export type OnFragment = (fragment: KiipFragment) => void;

export type Unsubscribe = () => void;

export interface KiipDatabase<Transaction> {
  withTransaction<T>(exec: (t: Transaction, done: (val: T) => DONE_TOKEN) => DONE_TOKEN): Promise<T>;
  getDocuments(t: Transaction, onResolve: (documents: Array<KiipDocument<unknown>>) => DONE_TOKEN): DONE_TOKEN;
  subscribeDocuments(callback: (documents: Array<KiipDocument<unknown>>) => void): Unsubscribe;
  getDocument(
    t: Transaction,
    documentId: string,
    onResolve: (document: KiipDocument<unknown> | undefined) => DONE_TOKEN
  ): DONE_TOKEN;
  subscribeDocument(documentId: string, callback: (document: KiipDocument<unknown>) => void): Unsubscribe;
  addDocument(t: Transaction, document: KiipDocument<unknown>, onResolve: () => DONE_TOKEN): DONE_TOKEN;
  setMetadata(t: Transaction, documentId: string, meta: unknown, onResolve: () => DONE_TOKEN): DONE_TOKEN;
  addFragments(t: Transaction, fragments: Array<KiipFragment>, onResolve: () => DONE_TOKEN): DONE_TOKEN;
  onEachFragment(t: Transaction, documentId: string, onFragment: OnFragment, onResolve: () => DONE_TOKEN): DONE_TOKEN;
  getFragmentsSince(
    t: Transaction,
    documentId: string,
    timestamp: Timestamp,
    skipNodeId: string,
    onResolve: (fragments: Array<KiipFragment>) => DONE_TOKEN
  ): DONE_TOKEN;
}
