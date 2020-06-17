import { MerkleTree } from './MerkleTree';
import { SubscribeMethod } from 'suub';
import { Timestamp } from './Timestamp';

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
  withTransaction<T>(exec: (t: Transaction) => Promise<T>): Promise<T>;
  getDocuments(t: Transaction): Promise<Array<KiipDocumentInternal>>;
  getDocument(t: Transaction, documentId: string): Promise<KiipDocumentInternal>;
  addDocument(t: Transaction, document: KiipDocumentInternal): Promise<void>;
  addFragments(t: Transaction, fragments: Array<KiipFragment>): Promise<void>;
  getFragmentsSince(
    t: Transaction,
    documentId: string,
    timestamp: Timestamp,
    skipNodeId: string
  ): Promise<Array<KiipFragment>>;
  onEachFragment(t: Transaction, documentId: string, onFragment: OnFragment): Promise<void>;
}
