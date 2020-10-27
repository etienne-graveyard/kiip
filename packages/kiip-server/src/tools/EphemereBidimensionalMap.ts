import { createBidimensionalMap } from './BidimensionalMap';

export interface EphemereBidimensionalMap<T> {
  get(k1: string, k2: string): T | undefined;
  count(k1: string): number;
  set(k1: string, k2: string, value: T, ttl?: number): void;
  has(k1: string, k2: string): boolean;
  remove(k1: string, k2: string): void;
}

export interface EphemereBidimensionalMapOptions {
  defaultTtl?: number;
  cleanupEvery?: number;
}

export interface EphemereObject<T> {
  expireAt: number;
  data: T;
}

function nowInSec(): number {
  return Math.trunc(Date.now() / 1000);
}

export function createEphemereBidimensionalMap<T>(
  options: EphemereBidimensionalMapOptions = {}
): EphemereBidimensionalMap<T> {
  const { cleanupEvery = 60, defaultTtl = 120 } = options;
  const obj = createBidimensionalMap<EphemereObject<T>>();

  setInterval(cleanup, cleanupEvery * 1000);

  return {
    set,
    get,
    has,
    count,
    remove,
  };

  function set(k1: string, k2: string, value: T, ttl: number = defaultTtl): void {
    obj.set(k1, k2, {
      expireAt: nowInSec() + ttl,
      data: value,
    });
  }

  function has(k1: string, k2: string): boolean {
    const v = obj.get(k1, k2);
    if (!v) {
      return false;
    }
    if (v.expireAt <= nowInSec()) {
      return false;
    }
    return true;
  }

  function count(k1: string): number {
    const now = nowInSec();
    const all = obj.get(k1);
    return all.filter((v) => v.expireAt > now).length;
  }

  function get(k1: string, k2: string): T | undefined {
    if (has(k1, k2)) {
      return obj.get(k1, k2)!.data;
    }
    return undefined;
  }

  function remove(k1: string, k2: string): void {
    obj.delete(k1, k2);
  }

  function cleanup() {
    const now = nowInSec();
    const deleteQueue: Array<[string, string]> = [];
    obj.forEach((k1, k2, v) => {
      if (v.expireAt <= now) {
        deleteQueue.push([k1, k2]);
      }
    });
    deleteQueue.forEach(([k1, k2]) => {
      obj.delete(k1, k2);
    });
    obj.cleanup();
  }
}
