import { MurmurHash } from './MurmurHash';

export class Timestamp {
  protected _state: {
    millis: number;
    counter: number;
    node: string;
  };

  constructor(millis: number, counter: number, node: string) {
    this._state = { millis, counter, node };
  }

  valueOf() {
    return this.toString();
  }

  toString() {
    return [
      new Date(this.millis).toISOString(),
      ('0000' + this.counter.toString(16).toUpperCase()).slice(-4),
      this.node,
    ].join('-');
  }

  get millis() {
    return this._state.millis;
  }

  get counter() {
    return this._state.counter;
  }

  get node() {
    return this._state.node;
  }

  get hash() {
    return MurmurHash(this.toString());
  }

  /**
   * Converts a fixed-length string timestamp to the structured value
   */
  static parse(timestamp: string): Timestamp {
    const parts = timestamp.split('-');
    if (parts && parts.length === 5) {
      const millis = Date.parse(parts.slice(0, 3).join('-')).valueOf();
      const counter = parseInt(parts[3], 16);
      const node = parts[4];
      if (!isNaN(millis) && !isNaN(counter)) {
        return new Timestamp(millis, counter, node);
      }
    }
    throw new Error(`Invalid Timestamp ${timestamp}`);
  }

  static ClockDriftError: typeof ClockDriftError;
  static DuplicateNodeError: typeof DuplicateNodeError;
  static OverflowError: typeof OverflowError;
}

export class MutableTimestamp extends Timestamp {
  setMillis(n: number) {
    this._state.millis = n;
  }

  setCounter(n: number) {
    this._state.counter = n;
  }

  static from(timestamp: Timestamp) {
    return new MutableTimestamp(timestamp.millis, timestamp.counter, timestamp.node);
  }
}

class DuplicateNodeError extends Error {
  constructor(node: string) {
    super('duplicate node identifier ' + node);
    Object.setPrototypeOf(this, DuplicateNodeError.prototype);
  }
}
Timestamp.DuplicateNodeError = DuplicateNodeError;

class ClockDriftError extends Error {
  constructor(...args: Array<string | number>) {
    super(['maximum clock drift exceeded', ...args].join(' '));
    Object.setPrototypeOf(this, ClockDriftError.prototype);
  }
}
Timestamp.ClockDriftError = ClockDriftError;

class OverflowError extends Error {
  constructor() {
    super('timestamp counter overflow');
    Object.setPrototypeOf(this, OverflowError.prototype);
  }
}
Timestamp.OverflowError = OverflowError;
