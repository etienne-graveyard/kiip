import { HybridLogicalClock } from './HybridLogicalClock';
import { Timestamp, TimestampWithConfig } from './Timestamp';
import { MerkleTree, MerkleTreeSyncMessage, MerkleTreeHandleSyncResult, MerkleTreeRoot } from './MerkleTree';

export type KiipState = {
  clock: Timestamp;
  tree: MerkleTreeRoot;
};

export type KiipConfig = {
  Timestamp: TimestampWithConfig;
  now: () => number;
};

export type KiipHandleItemsResult = {
  state: KiipState;
  added: Array<Timestamp> | null;
};

const DEFAULT_CONFIG: Readonly<Required<KiipConfig>> = {
  Timestamp: Timestamp.withConfig(),
  now: () => Math.floor(Date.now() / 1000),
};

export class Kiip {
  HybridLogicalClock: HybridLogicalClock;
  Timestamp: TimestampWithConfig;
  MerkleTree: MerkleTree;

  private constructor(config: KiipConfig) {
    const { Timestamp, now } = {
      ...DEFAULT_CONFIG,
      ...config,
    };
    this.Timestamp = Timestamp;
    this.HybridLogicalClock = new HybridLogicalClock({ Timestamp, now });
    this.MerkleTree = new MerkleTree({ Timestamp });
  }

  commit(state: KiipState): KiipState {
    const clock = this.HybridLogicalClock.send(state.clock);
    return { clock, tree: this.MerkleTree.insert(state.tree, clock) };
  }

  prepareSync(state: KiipState): MerkleTreeSyncMessage {
    return this.MerkleTree.prepareSync(state.tree);
  }

  // receive items and return what to insert
  handleItems(state: KiipState, items: Array<Timestamp>): KiipHandleItemsResult {
    const result = this.MerkleTree.handleItems(state.tree, items);
    let nextClock = state.clock;
    if (result.added) {
      result.added.forEach((item) => {
        nextClock = this.HybridLogicalClock.receive(nextClock, item);
      });
    }
    return { state: { clock: nextClock, tree: result.tree }, added: result.added };
  }

  handleSync(state: KiipState, message: MerkleTreeSyncMessage): MerkleTreeHandleSyncResult {
    return this.MerkleTree.handleSync(state.tree, message);
  }

  create(id: string): KiipState {
    return {
      clock: this.HybridLogicalClock.create(id),
      tree: this.MerkleTree.empty(),
    };
  }

  static DEFAULT_CONFIG = DEFAULT_CONFIG;
}
