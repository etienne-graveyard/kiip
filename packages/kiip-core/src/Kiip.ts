import { HybridLogicalClock } from './HybridLogicalClock';
import { Timestamp, TimestampWithConfig } from './Timestamp';
import { MerkleTree, MerkleTreeSyncMessage } from './MerkleTree';
import { SubscribeMethod, Subscription } from 'suub';

export type Item<T> = { ts: Timestamp; payload: T };
export type Items<T> = Array<Item<T>>;
export type HandleSyncResult<T> = {
  responses: Array<MerkleTreeSyncMessage> | null;
  items: Items<T> | null;
};

export type KiipDatabase<T> = {
  getItems(timestamps: Array<Timestamp>): Promise<Items<T>>;
  update(tree: MerkleTree, clock: Timestamp, items: Items<T>): Promise<void>;
};

export type KiipState = {
  clock: Timestamp;
  tree: MerkleTree;
};

export type KiipConfig = {
  Timestamp: TimestampWithConfig;
  now: () => number;
};

const DEFAULT_CONFIG: Readonly<Required<KiipConfig>> = {
  Timestamp: Timestamp.withConfig(),
  now: () => Math.floor(Date.now() / 1000),
};

export class Kiip<T> {
  private readonly hlc: HybridLogicalClock;
  private readonly db: KiipDatabase<T>;
  private readonly itemsSub = Subscription() as Subscription<Items<T>>;
  private readonly emitSub = Subscription() as Subscription<Item<T>>;

  private tree: MerkleTree;
  private saveQueue: Items<T> = [];
  private saving = false;

  private constructor(initialState: KiipState, db: KiipDatabase<T>, config: KiipConfig) {
    this.tree = initialState.tree;
    this.db = db;
    this.hlc = HybridLogicalClock.restore(initialState.clock, { Timestamp: config.Timestamp, now: config.now });
  }

  onItems: SubscribeMethod<Items<T>> = this.itemsSub.subscribe;
  onEmit: SubscribeMethod<Item<T>> = this.emitSub.subscribe;

  getState(): KiipState {
    return { tree: this.tree, clock: this.hlc.current };
  }

  commit(payload: T): void {
    const ts = this.hlc.send();
    this.tree = this.tree.insert(ts);
    this.saveQueue.push({ ts, payload });
    this.itemsSub.emit([{ ts, payload }]);
    this.emitSub.emit({ ts, payload });
    this.save();
  }

  prepareSync(): MerkleTreeSyncMessage {
    return this.tree.prepareSync();
  }

  async handleItems(items: Items<T>): Promise<void> {
    const result = this.tree.handleItems(items.map((i) => i.ts));
    this.tree = result.tree;

    if (result.added) {
      const addedItems = result.added.map((ts) => notNil(items.find((i) => i.ts === ts)));
      addedItems.forEach((item) => {
        this.hlc.receive(item.ts);
        // clock = HLC.merge(clock, item.ts);
        this.saveQueue.push(item);
      });
      this.itemsSub.emit(addedItems);
      this.save();
    }
  }

  async handleSync(message: MerkleTreeSyncMessage): Promise<HandleSyncResult<T>> {
    const { items, responses } = this.tree.handleSync(message);
    const itemsResolved = items === null ? null : await this.db.getItems(items);
    return {
      responses,
      items: itemsResolved,
    };
  }

  private save() {
    if (this.saving) {
      return;
    }
    if (this.saveQueue.length === 0) {
      return;
    }
    this.saving = true;
    this.saveInternal();
  }

  private async saveInternal() {
    if (this.saving === false) {
      throw new Error('What ?');
    }
    if (this.saveQueue.length === 0) {
      this.saving = false;
      return;
    }
    const items = this.saveQueue;
    this.saveQueue = [];
    await this.db.update(this.tree, this.hlc.current, items);
    this.saveInternal();
  }

  static create<T>(id: string, db: KiipDatabase<T>, config: Partial<KiipConfig> = {}): Kiip<T> {
    const conf = { ...DEFAULT_CONFIG, ...config };
    return new Kiip(
      {
        clock: HybridLogicalClock.create(id, { Timestamp: conf.Timestamp, now: conf.now }).current,
        tree: MerkleTree.empty({ Timestamp: conf.Timestamp }),
      },
      db,
      conf
    );
  }

  static restore<T>(initialState: KiipState, db: KiipDatabase<T>, config: Partial<KiipConfig> = {}): Kiip<T> {
    const conf = { ...DEFAULT_CONFIG, ...config };
    return new Kiip(initialState, db, conf);
  }

  static DEFAULT_CONFIG = DEFAULT_CONFIG;
}

function notNil<T>(val: T | null | undefined): T {
  if (val === null || val === undefined) {
    throw new Error('Unexpected null');
  }
  return val;
}
