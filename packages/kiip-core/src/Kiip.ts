import { HybridLogicalClock, Timestamp } from './HybridLogicalClock';
import { MerkleTree, MTSyncMessage, MTSyncMessageRequest, MTSyncMessageResponse } from './MerkleTree';
import { SubscribeMethod, Subscription } from 'suub';

export type Item<T> = { ts: string; payload: T };
export type Items<T> = Array<Item<T>>;

export type HandleMessageResult<T> = {
  responses: Array<MTSyncMessage> | null;
  items: Items<T> | null;
};

export type Kiip<T> = {
  onItems: SubscribeMethod<Items<T>>;
  commit(payload: T): void;
  prepareSync(): MTSyncMessageRequest;
  handleMessage(message: MTSyncMessage): Promise<HandleMessageResult<T>>;
  handleItems(items: Items<T>): Promise<void>;
  getState(): KiipState;
};

export type KiipDatabase<T> = {
  getItems(timestamps: Array<string>): Promise<Items<T>>;
  update(tree: MerkleTree, clock: Timestamp, items: Items<T>): Promise<void>;
};

export type KiipState = {
  clock: Timestamp;
  tree: MerkleTree;
};

export const Kiip = {
  restore: restoreKiip,
  createInitialState: createKiipInitialState,
};

const HLC = HybridLogicalClock.create();

function restoreKiip<T>(initialState: KiipState, db: KiipDatabase<T>): Kiip<T> {
  const itemsSub = Subscription() as Subscription<Items<T>>;

  let clock = initialState.clock;
  let tree: MerkleTree = initialState.tree;

  let saveQueue: Items<T> = [];
  let saving = false;

  return {
    onItems: itemsSub.subscribe,
    commit,
    getState,
    prepareSync,
    handleMessage,
    handleItems,
  };

  function getState(): KiipState {
    return { tree, clock };
  }

  function save() {
    if (saving) {
      return;
    }
    if (saveQueue.length === 0) {
      return;
    }
    saving = true;
    saveInternal();
  }

  async function saveInternal() {
    if (saving === false) {
      throw new Error('What ?');
    }
    if (saveQueue.length === 0) {
      saving = false;
      return;
    }
    const items = saveQueue;
    saveQueue = [];
    await db.update(tree, clock, items);
    saveInternal();
  }

  function commit(payload: T): void {
    const nextClock = HLC.next(clock);
    const ts = HLC.serialize(clock);

    // update tree
    tree = MerkleTree.insert(tree, ts);
    clock = nextClock;

    saveQueue.push({ ts, payload });
    itemsSub.emit([{ ts, payload }]);
    save();
  }

  function prepareSync(): MTSyncMessageRequest {
    return MerkleTree.prepareSync(tree);
  }

  async function handleItems(items: Items<T>): Promise<void> {
    const result = MerkleTree.handleItems(
      tree,
      items.map((i) => i.ts)
    );
    tree = result.tree;

    if (result.added) {
      const addedItems = result.added.map((ts) => notNil(items.find((i) => i.ts === ts)));
      addedItems.forEach((item) => {
        clock = HLC.merge(clock, item.ts);
        saveQueue.push(item);
      });
      itemsSub.emit(addedItems);
      save();
    }
  }

  async function handleMessage(message: MTSyncMessageResponse | MTSyncMessageRequest): Promise<HandleMessageResult<T>> {
    const { items, responses } = MerkleTree.handleMessage(tree, message);
    const itemsResolved = items === null ? null : await db.getItems(items);
    return {
      responses,
      items: itemsResolved,
    };
  }
}

function createKiipInitialState(id?: string): KiipState {
  return {
    clock: HLC.create(id),
    tree: MerkleTree.build(),
  };
}

function notNil<T>(val: T | null | undefined): T {
  if (val === null || val === undefined) {
    throw new Error('Unexpected null');
  }
  return val;
}
