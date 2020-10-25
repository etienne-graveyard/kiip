export type TimestampConfig = {
  timeBase: number;
  timeLength: number;
  counterBase: number;
  counterLength: number;
  idLength: number;
};

export type TimestampObj = {
  readonly time: number;
  readonly counter: number;
  readonly id: string;
};

const DEFAULT_CONFIG: Readonly<TimestampConfig> = {
  timeBase: 32,
  timeLength: 7,
  counterBase: 32,
  counterLength: 3,
  idLength: 8,
};

type TimestampCache = {
  str?: string;
  idCounter?: string;
};

export class TimestampWithConfig {
  private config: Readonly<TimestampConfig>;

  constructor(config: TimestampConfig) {
    this.config = config;
  }

  create(obj: TimestampObj): Timestamp;
  create(time: number, counter: number, id: string): Timestamp;
  create(time: number | TimestampObj, counter?: number, id?: string): Timestamp {
    if (typeof time !== 'number') {
      return new Timestamp(time, this.config);
    }
    if (counter === undefined) throw new InvalidTimestampsParamError('counter', 'missing paral');
    if (id === undefined) throw new InvalidTimestampsParamError('id', 'missing param');
    return new Timestamp({ time, counter, id }, this.config);
  }

  parse(ts: string): Timestamp;
  parse(ts: { time: number; idCounter: string }): Timestamp;
  parse(ts: string | { time: number; idCounter: string }): Timestamp {
    if (typeof ts === 'string') {
      return Timestamp.parse(ts, this.config);
    }
    return Timestamp.parse(ts, this.config);
  }
}

class TimestampsError extends Error {
  constructor(public message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

class TimestampsCounterOverflowError extends TimestampsError {
  constructor(public maxCounter: number) {
    super(`counter overflow reached (${maxCounter})`);
  }
}

class TimestampsTimeOverflowError extends TimestampsError {
  constructor(public maxTime: number) {
    super(`time overflow reached (${maxTime})`);
  }
}

class InvalidTimestampsLengthError extends TimestampsError {
  constructor(public ts: string, public expectedLength: number) {
    super(`invalid timestamp length: expected ${expectedLength}, got ${ts.length}`);
  }
}

class InvalidTimestampsParamError extends TimestampsError {
  constructor(public param: string, public message: string) {
    super(`invalid timestamp param "${param}": ${message}`);
  }
}

class TimestampsNumberParseError extends TimestampsError {
  constructor(public str: string, public base: number, public message: string = '') {
    super(`cannot parse ${str} with base ${base}` + (message && ': ') + message);
  }
}

export class Timestamp {
  readonly time!: number;
  readonly counter!: number;
  readonly id!: string;

  private cache: TimestampCache = {};
  private config: Readonly<TimestampConfig>;

  constructor(obj: TimestampObj, config: TimestampConfig) {
    this.config = config;
    const { counterBase, counterLength, idLength, timeBase, timeLength } = this.config;
    const timeMaxValue = Math.pow(timeBase, timeLength) - 1;
    const counterMaxValue = Math.pow(counterBase, counterLength) - 1;
    const { time, counter, id } = obj;
    if (time > timeMaxValue) throw new TimestampsTimeOverflowError(timeMaxValue);
    if (id.length !== idLength)
      throw new InvalidTimestampsParamError('id', `invalid length, expected ${idLength}, got ${id.length}`);
    if (counter > counterMaxValue) throw new TimestampsCounterOverflowError(counterMaxValue);

    this.time = time;
    this.counter = counter;
    this.id = id;
  }

  get idCounter(): string {
    return (
      this.cache.idCounter ??
      (this.cache.idCounter = numToString(this.counter, this.config.counterBase, this.config.counterLength) + this.id)
    );
  }

  toString(): string {
    return (
      this.cache.str ??
      (this.cache.str = numToString(this.time, this.config.timeBase, this.config.timeLength) + this.idCounter)
    );
  }

  toJson(): string {
    return this.toString();
  }

  set(obj: Partial<TimestampObj>): Timestamp {
    return new Timestamp({ time: this.time, id: this.id, counter: this.counter, ...obj }, this.config);
  }

  compare(ts: Timestamp): number {
    return this.toString().localeCompare(ts.toString());
  }

  equal(ts: Timestamp): boolean {
    return ts.time === this.time && ts.counter === this.counter && ts.id === this.id;
  }

  toObject(): TimestampObj {
    return {
      id: this.id,
      time: this.time,
      counter: this.counter,
    };
  }

  static parse(ts: string, config: TimestampConfig): Timestamp;
  static parse(ts: { time: number; idCounter: string }, config: TimestampConfig): Timestamp;
  static parse(ts: string | { time: number; idCounter: string }, config: TimestampConfig): Timestamp {
    const { timeLength, counterLength, idLength, timeBase, counterBase } = config;
    if (typeof ts === 'string') {
      const totalLength = timeLength + counterLength + idLength;
      if (ts.length !== totalLength) {
        throw new InvalidTimestampsLengthError(ts, totalLength);
      }
      const time = ts.slice(0, timeLength);
      const idCounter = ts.slice(timeLength);
      return Timestamp.parse({ time: parseNum(time, timeBase), idCounter }, config);
    }
    const { time, idCounter } = ts;
    const counter = idCounter.slice(0, counterLength);
    const id = idCounter.slice(counterLength);
    return new Timestamp(
      {
        time,
        counter: parseNum(counter, counterBase),
        id,
      },
      config
    );
  }

  static withConfig(options: Partial<TimestampConfig> = {}): TimestampWithConfig {
    return new TimestampWithConfig({ ...DEFAULT_CONFIG, ...options });
  }

  static readonly DEFAULT_CONFIG = DEFAULT_CONFIG;

  // expose error classes
  static readonly TimestampsError = TimestampsError;
  static readonly TimestampsCounterOverflowError = TimestampsCounterOverflowError;
  static readonly TimestampsTimeOverflowError = TimestampsTimeOverflowError;
  static readonly InvalidTimestampsLengthError = InvalidTimestampsLengthError;
  static readonly InvalidTimestampsParamError = InvalidTimestampsParamError;
  static readonly TimestampsNumberParseError = TimestampsNumberParseError;
}

function numToString(num: number, base: number, length: number): string {
  return ('0'.repeat(length) + Math.floor(num).toString(base)).slice(-length);
}

function parseNum(str: string, base: number): number {
  let num: number;
  try {
    num = parseInt(str, base);
  } catch (error) {
    throw new TimestampsNumberParseError(str, base, error);
  }
  if (Number.isNaN(num)) {
    throw new TimestampsNumberParseError(str, base, 'result is NaN');
  }
  if (num < 0) {
    throw new TimestampsNumberParseError(str, base, 'result is negative');
  }
  return num;
}
