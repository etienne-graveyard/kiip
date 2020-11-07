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
  readonly config: Readonly<Required<HybridLogicalClockConfig>>;

  constructor(config: Partial<HybridLogicalClockConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  create(id: string): Timestamp {
    return this.config.Timestamp.create(this.config.now(), 0, id);
  }

  send(current: Timestamp): Timestamp {
    const time = this.config.now();
    if (time > current.time) {
      // reset counter
      return current.set({ time, counter: 0 });
    }
    // increment counter
    return current.set({ counter: current.counter + 1 });
  }

  receive(current: Timestamp, ts: string | Timestamp): Timestamp {
    const parsed = typeof ts === 'string' ? this.config.Timestamp.parse(ts) : ts;
    // TODO: make sure ts has the same config as current ?
    const time = this.config.now();
    if (time > current.time && time > parsed.time) {
      // reset counter
      return current.set({ time, counter: 0 });
    }
    if (current.time === parsed.time) {
      return current.set({ counter: Math.max(current.counter, parsed.counter) + 1 });
    }
    if (parsed.time > current.time) {
      return current.set({ time: parsed.time, counter: parsed.counter + 1 });
    }
    return current.set({ time, counter: current.counter + 1 });
  }

  static readonly DEFAULT_CONFIG = DEFAULT_CONFIG;
}
