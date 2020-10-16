import { COUNTER_BASE, COUNTER_LENGTH } from './constants';
import { MurmurHash } from './MurmurHash';

export class Timestamp {
  protected state: {
    millis: number;
    counter: number;
    node: string;
  };

  constructor(millis: number, counter: number, node: string) {
    this.state = { millis, counter, node };
  }

  valueOf(): string {
    return this.toString();
  }

  toString(): string {
    return [
      new Date(this.millis).toISOString(),
      ('0'.repeat(COUNTER_LENGTH) + this.counter.toString(COUNTER_BASE).toUpperCase()).slice(-COUNTER_LENGTH),
      this.node,
    ].join('-');
  }

  get millis(): number {
    return this.state.millis;
  }

  get counter(): number {
    return this.state.counter;
  }

  get node(): string {
    return this.state.node;
  }

  get hash(): number {
    return MurmurHash(this.toString());
  }

  /**
   * Converts a fixed-length string timestamp to the structured value
   */
  static parse(timestamp: string): Timestamp {
    const parts = timestamp.split('-');
    if (parts && parts.length === 5) {
      const millis = Date.parse(parts.slice(0, 3).join('-')).valueOf();
      const counter = parseInt(parts[3], COUNTER_BASE);
      const node = parts[4];
      if (!Number.isNaN(millis) && !Number.isNaN(counter)) {
        return new Timestamp(millis, counter, node);
      }
    }
    throw new Error(`Invalid Timestamp ${timestamp}`);
  }
}

export class MutableTimestamp extends Timestamp {
  setMillis(n: number): void {
    this.state.millis = n;
  }

  setCounter(n: number): void {
    this.state.counter = n;
  }

  static from(timestamp: Timestamp): MutableTimestamp {
    return new MutableTimestamp(timestamp.millis, timestamp.counter, timestamp.node);
  }
}
