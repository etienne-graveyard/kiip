import { MerkleTree } from './MerkleTree';
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
  nodeId: string;
  data: KiipDocumentData<Schema>;
  meta: Metadata;
}

export type OnFragment = (fragment: KiipFragment) => void;

export type Unsubscribe = () => void;

export interface KiipDatabase<Transaction> {
  subscribeDocuments(callback: (documents: Array<KiipDocument<unknown>>) => void): Unsubscribe;
  subscribeDocument(documentId: string, callback: (document: KiipDocument<unknown>) => void): Unsubscribe;
  withTransaction<T>(
    exec: (t: Transaction, onResolve: (val: T) => DONE_TOKEN, onReject: (val: T) => DONE_TOKEN) => DONE_TOKEN
  ): Promise<T>;
  getDocuments(
    t: Transaction,
    onResolve: (documents: Array<KiipDocument<unknown>>) => DONE_TOKEN,
    onReject: (error: any) => DONE_TOKEN
  ): DONE_TOKEN;
  getDocument(
    t: Transaction,
    documentId: string,
    onResolve: (document: KiipDocument<unknown> | undefined) => DONE_TOKEN,
    onReject: (error: any) => DONE_TOKEN
  ): DONE_TOKEN;
  addDocument(
    t: Transaction,
    document: KiipDocument<unknown>,
    onResolve: () => DONE_TOKEN,
    onReject: (error: any) => DONE_TOKEN
  ): DONE_TOKEN;
  setMetadata(
    t: Transaction,
    documentId: string,
    meta: unknown,
    onResolve: () => DONE_TOKEN,
    onReject: (error: any) => DONE_TOKEN
  ): DONE_TOKEN;
  addFragments(
    t: Transaction,
    fragments: Array<KiipFragment>,
    onResolve: () => DONE_TOKEN,
    onReject: (error: any) => DONE_TOKEN
  ): DONE_TOKEN;
  onEachFragment(
    t: Transaction,
    documentId: string,
    onFragment: OnFragment,
    onResolve: () => DONE_TOKEN,
    onReject: (error: any) => DONE_TOKEN
  ): DONE_TOKEN;
  getFragmentsSince(
    t: Transaction,
    documentId: string,
    timestamp: Timestamp,
    skipNodeId: string,
    onResolve: (fragments: Array<KiipFragment>) => DONE_TOKEN,
    onReject: (error: any) => DONE_TOKEN
  ): DONE_TOKEN;
}
