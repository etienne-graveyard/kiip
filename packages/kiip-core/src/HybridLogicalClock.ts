import { Timestamp, TimestampWithConfig } from './Timestamp';

export type HybridLogicalClockConfig = {
  Timestamp: TimestampWithConfig;
  now: () => number;
};

const DEFAULT_CONFIG: Readonly<Required<HybridLogicalClockConfig>> = {
  Timestamp: Timestamp.withConfig(),
  now: () => Math.floor(Date.now() / 1000),
};

export class HybridLogicalClock {
  private _current: Timestamp;

  readonly config: Readonly<Required<HybridLogicalClockConfig>>;

  private constructor(current: Timestamp, config: HybridLogicalClockConfig) {
    this.config = config;
    this._current = current;
  }

  get current(): Timestamp {
    return this._current;
  }

  get id(): string {
    return this._current.id;
  }

  send(): Timestamp {
    const time = this.config.now();
    if (time > this._current.time) {
      // reset counter
      this._current = this._current.set({ time, counter: 0 });
    } else {
      // increment counter
      this._current = this._current.set({ counter: this._current.counter + 1 });
    }
    return this._current;
  }

  receive(ts: string | Timestamp): void {
    const current = this._current;
    const parsed = typeof ts === 'string' ? this.config.Timestamp.parse(ts) : ts;
    // TODO: make sure ts has the same config as current ?
    const time = this.config.now();
    if (time > current.time && time > parsed.time) {
      // reset counter
      this._current = this._current.set({ time, counter: 0 });
      return;
    }
    if (current.time === parsed.time) {
      this._current = this._current.set({ counter: Math.max(current.counter, parsed.counter) + 1 });
      return;
    }
    if (parsed.time > current.time) {
      this._current = this._current.set({ time: parsed.time, counter: parsed.counter + 1 });
      return;
    }
    this._current = this._current.set({ time, counter: current.counter + 1 });
  }

  static create(id: string, config: HybridLogicalClockConfig): HybridLogicalClock {
    return new HybridLogicalClock(config.Timestamp.create({ time: config.now(), counter: 0, id }), config);
  }

  static restore(current: Timestamp, config: HybridLogicalClockConfig): HybridLogicalClock {
    return new HybridLogicalClock(current, config);
  }

  static readonly DEFAULT_CONFIG = DEFAULT_CONFIG;
}

// function createId(base: number, length: number): string {
//   const max = Math.pow(base, length);
//   const num = Math.floor(Math.random() * max);
//   return ('0'.repeat(length) + Math.floor(num).toString(base)).slice(-length);
// }
