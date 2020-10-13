import { Timestamp, MutableTimestamp } from './Timestamp';
import { MerkleTree } from './MerkleTree';

const MAX_DRIFT = 60000;

export class Clock {
  private timestamp: MutableTimestamp;
  private internalMerkle: MerkleTree;

  constructor(nodeId: string) {
    this.timestamp = new MutableTimestamp(0, 0, nodeId);
    this.internalMerkle = {};
  }

  private insert(timestamp: Timestamp) {
    this.internalMerkle = MerkleTree.insert(this.internalMerkle, timestamp);
  }

  public get node(): string {
    return this.timestamp.node;
  }

  public get merkle(): MerkleTree {
    return this.internalMerkle;
  }

  /**
   * Timestamp send. Generates a unique, monotonic timestamp suitable
   * for transmission to another system in string format
   */
  public send(): Timestamp {
    // Retrieve the local wall time
    const phys = Date.now();

    // Unpack the clock.timestamp logical time and counter
    const lOld = this.timestamp.millis;
    const cOld = this.timestamp.counter;

    // Calculate the next logical time and counter
    // * ensure that the logical time never goes backward
    // * increment the counter if phys time does not advance
    const lNew = Math.max(lOld, phys);
    const cNew = lOld === lNew ? cOld + 1 : 0;

    // Check the result for drift and counter overflow
    if (lNew - phys > MAX_DRIFT) {
      throw new Clock.ClockDriftError(lNew, phys, MAX_DRIFT);
    }
    if (cNew > 65535) {
      throw new Clock.OverflowError();
    }

    // Repack the logical time/counter
    this.timestamp.setMillis(lNew);
    this.timestamp.setCounter(cNew);

    const ts = new Timestamp(this.timestamp.millis, this.timestamp.counter, this.timestamp.node);
    this.insert(ts);
    return ts;
  }

  // Timestamp receive. Parses and merges a timestamp from a remote
  // system with the local timeglobal uniqueness and monotonicity are
  // preserved
  public recv(msg: Timestamp): void {
    const phys = Date.now();

    // Unpack the message wall time/counter
    const lMsg = msg.millis;
    const cMsg = msg.counter;

    // NOTE: We don't do that because it fail when we restore local state
    // maybe we should have two distinct method for restore and recv ?

    // Assert the node id and remote clock drift
    // if (msg.node === this.timestamp.node) {
    //   throw new Timestamp.DuplicateNodeError(this.timestamp.node);
    // }
    if (lMsg - phys > MAX_DRIFT) {
      throw new Clock.ClockDriftError();
    }

    // Unpack the clock.timestamp logical time and counter
    const lOld = this.timestamp.millis;
    const cOld = this.timestamp.counter;

    // Calculate the next logical time and counter.
    // Ensure that the logical time never goes backward;
    // * if all logical clocks are equal, increment the max counter,
    // * if max = old > message, increment local counter,
    // * if max = messsage > old, increment message counter,
    // * otherwise, clocks are monotonic, reset counter
    const lNew = Math.max(Math.max(lOld, phys), lMsg);
    const cNew =
      lNew === lOld && lNew === lMsg
        ? Math.max(cOld, cMsg) + 1
        : lNew === lOld
        ? cOld + 1
        : lNew === lMsg
        ? cMsg + 1
        : 0;

    // Check the result for drift and counter overflow
    if (lNew - phys > MAX_DRIFT) {
      throw new Clock.ClockDriftError();
    }
    if (cNew > 65535) {
      throw new Clock.OverflowError();
    }

    // Repack the logical time/counter
    this.timestamp.setMillis(lNew);
    this.timestamp.setCounter(cNew);

    this.insert(msg);
  }

  static ClockDriftError: typeof ClockDriftError;
  static DuplicateNodeError: typeof DuplicateNodeError;
  static OverflowError: typeof OverflowError;
}

class DuplicateNodeError extends Error {
  constructor(node: string) {
    super('duplicate node identifier ' + node);
    Object.setPrototypeOf(this, DuplicateNodeError.prototype);
  }
}
Clock.DuplicateNodeError = DuplicateNodeError;

class ClockDriftError extends Error {
  constructor(...args: Array<string | number>) {
    super(['maximum clock drift exceeded', ...args].join(' '));
    Object.setPrototypeOf(this, ClockDriftError.prototype);
  }
}
Clock.ClockDriftError = ClockDriftError;

class OverflowError extends Error {
  constructor() {
    super('timestamp counter overflow');
    Object.setPrototypeOf(this, OverflowError.prototype);
  }
}
Clock.OverflowError = OverflowError;
