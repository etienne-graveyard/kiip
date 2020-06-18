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

export interface KiipDocumentInternal {
  id: string;
  name: string;
  nodeId: string;
}

export interface KiipSchema {
  [table: string]: {
    [column: string]: any;
  };
}

export type KiipState<Schema extends KiipSchema> = {
  [K in keyof Schema]: {
    [row: string]: Schema[K];
  };
};

export interface SyncData {
  nodeId: string;
  fragments: Array<KiipFragment>;
  merkle: MerkleTree;
}

export interface KiipDocument {
  id: string;
  name: string;
}

export interface KiipDocumentFacade<Schema extends KiipSchema> {
  id: string;
  insert<K extends keyof Schema>(table: K, doc: Schema[K]): Promise<string>;
  update<K extends keyof Schema>(table: K, id: string, doc: Partial<Schema[K]>): Promise<void>;
  subscribe: SubscribeMethod<KiipState<Schema>>;
  getState: () => KiipState<Schema>;
  prepareSync(): Promise<SyncData>;
  handleSync(data: SyncData): Promise<SyncData>;
}

export type OnFragment = (fragment: KiipFragment) => void;

export interface KiipDatabase<Transaction> {
  withTransaction<T>(exec: (t: Transaction, done: (val: T) => DONE_TOKEN) => DONE_TOKEN): Promise<T>;
  getDocuments(t: Transaction, onResolve: (documents: Array<KiipDocumentInternal>) => DONE_TOKEN): DONE_TOKEN;
  getDocument(
    t: Transaction,
    documentId: string,
    onResolve: (document: KiipDocumentInternal) => DONE_TOKEN
  ): DONE_TOKEN;
  addDocument(t: Transaction, document: KiipDocumentInternal, onResolve: () => DONE_TOKEN): DONE_TOKEN;
  addFragments(t: Transaction, fragments: Array<KiipFragment>, onResolve: () => DONE_TOKEN): DONE_TOKEN;
  getFragmentsSince(
    t: Transaction,
    documentId: string,
    timestamp: Timestamp,
    skipNodeId: string,
    onResolve: (fragments: Array<KiipFragment>) => DONE_TOKEN
  ): DONE_TOKEN;
  onEachFragment(t: Transaction, documentId: string, onFragment: OnFragment, onResolve: () => DONE_TOKEN): DONE_TOKEN;
}
