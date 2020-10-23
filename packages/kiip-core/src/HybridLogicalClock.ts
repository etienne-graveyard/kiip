export type Timestamp = {
  readonly time: number;
  readonly counter: number;
  readonly id: string;
};

export type HybridLogicalClock = {
  create(id?: string): Timestamp;

  serialize(time: number, counter: number, id: string): string;
  serialize(ts: Timestamp): string;
  parse(ts: string): Timestamp;
  extractTime(ts: string): [number, string]; // [time, rest(counter + id)]
  injectTime(time: number, counterAndId: string): string; // [time, rest(counter + id)]

  next(hlc: Timestamp): Timestamp;
  merge(hlc: Timestamp, ts: string | Timestamp): Timestamp;
};

export type HybridLogicalClockOptions = {
  now?: () => number;
  timePrecision?: number;
  timeBase?: number;
  timeLength?: number;
  counterBase?: number;
  counterLength?: number;
  idLength?: number;
};

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

class TimestampsNumberParseError extends Error {
  constructor(public str: string, public base: number, public message: string = '') {
    super(`cannot parse ${str} with base ${base}` + (message && ': ') + message);
    Object.setPrototypeOf(this, TimestampsNumberParseError.prototype);
  }
}

// With the following setting we get a very compact timestamp with
// - time overflow at 34359738368 (year 3058 if time in second)
// - counter overflow at 32768
const DEFAULT_OPTIONS: Required<HybridLogicalClockOptions> = {
  now: () => Math.floor(Date.now() / 1000),
  timePrecision: 5000,
  timeBase: 32,
  timeLength: 7,
  counterBase: 32,
  counterLength: 3,
  idLength: 8,
};

export const HybridLogicalClock = {
  create: createHybridLogicalClock,
  TimestampsError,
  InvalidTimestampsLengthError,
  TimestampsNumberParseError,
  InvalidTimestampsParamError,
  TimestampsCounterOverflowError,
  TimestampsTimeOverflowError,
};

function createHybridLogicalClock(options: HybridLogicalClockOptions = {}): HybridLogicalClock {
  const { now, counterBase, counterLength, idLength, timeBase, timeLength } = { ...DEFAULT_OPTIONS, ...options };

  // TODO: validate options (base cannot be greater than 32)
  const timeMaxValue = Math.pow(timeBase, timeLength) - 1;
  const counterMaxValue = Math.pow(counterBase, counterLength) - 1;
  const totalLength = timeLength + counterLength + idLength;

  return {
    create,
    next,
    merge,
    parse,
    extractTime,
    injectTime,
    serialize,
  };

  function parse(ts: string): Timestamp {
    if (ts.length !== totalLength) {
      throw new InvalidTimestampsLengthError(ts, totalLength);
    }
    const time = ts.slice(0, timeLength);
    const counter = ts.slice(timeLength, timeLength + counterLength);
    const id = ts.slice(timeLength + counterLength);
    return {
      id,
      time: parseNum(time, timeBase),
      counter: parseNum(counter, counterBase),
    };
  }

  function extractTime(ts: string): [number, string] {
    if (ts.length !== totalLength) {
      throw new InvalidTimestampsLengthError(ts, totalLength);
    }
    const time = ts.slice(0, timeLength);
    const rest = ts.slice(timeLength);
    return [parseNum(time, timeBase), rest];
  }

  function injectTime(time: number, counterAndId: string): string {
    return numToString(time, timeBase, timeLength) + counterAndId;
  }

  function serialize(time: number, counter: number, id: string): string;
  function serialize(obj: Timestamp): string;
  function serialize(arg1: number | Timestamp, counter?: number, id?: string): string {
    if (typeof arg1 !== 'number') {
      return serialize(arg1.time, arg1.counter, arg1.id);
    }
    if (counter === undefined) throw new InvalidTimestampsParamError('counter', 'missing paral');
    if (id === undefined) throw new InvalidTimestampsParamError('id', 'missing param');
    if (arg1 > timeMaxValue) throw new TimestampsTimeOverflowError(timeMaxValue);
    if (id.length !== idLength)
      throw new InvalidTimestampsParamError('id', `invalid length, expected ${idLength}, got ${id.length}`);
    if (counter > counterMaxValue) throw new TimestampsCounterOverflowError(timeMaxValue);

    return numToString(arg1, timeBase, timeLength) + numToString(counter, counterBase, counterLength) + id;
  }

  function create(id?: string): Timestamp {
    return {
      id: id !== undefined ? id : createId(32, 8),
      counter: 0,
      time: now(),
    };
  }

  function next(hlc: Timestamp): Timestamp {
    const time = now();
    if (time > hlc.time) {
      // reset counter
      return { id: hlc.id, time, counter: 0 };
    }
    // increment counter
    return { id: hlc.id, time: hlc.time, counter: hlc.counter + 1 };
  }

  function merge(hlc: Timestamp, ts: string | Timestamp): Timestamp {
    const parsed = typeof ts === 'string' ? parse(ts) : ts;
    const time = now();

    if (time > hlc.time && time > parsed.time) {
      // reset counter
      return { id: hlc.id, time, counter: 0 };
    }
    if (hlc.time === parsed.time) {
      return { id: hlc.id, time: hlc.time, counter: Math.max(hlc.counter, parsed.counter) + 1 };
    }
    if (parsed.time > hlc.time) {
      return { id: hlc.id, time: parsed.time, counter: parsed.counter + 1 };
    }
    return { id: hlc.id, time, counter: hlc.counter + 1 };
  }
}

function createId(base: number, length: number): string {
  const max = Math.pow(base, length);
  const num = Math.floor(Math.random() * max);
  return ('0'.repeat(length) + Math.floor(num).toString(base)).slice(-length);
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
