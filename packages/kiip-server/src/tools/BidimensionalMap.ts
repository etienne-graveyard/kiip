/**
 * This is a Bidimensional object that prevent memory leaks by removing empty keys
 */

export interface BidimensionalMap<T> {
  get(k1: string): Array<T>;
  get(k1: string, k2: string): T | undefined;
  set(k1: string, k2: string, value: T): void;
  has(k1: string, k2: string): boolean;
  delete(k1: string, k2: string): void;
  cleanup(): void;
  forEach(callbackfn: (k1: string, k2: string, value: T) => void): void;
}

export function createBidimensionalMap<T>(): BidimensionalMap<T> {
  const root: Map<string, Map<string, T>> = new Map();

  return {
    get,
    set,
    has,
    delete: remove,
    cleanup,
    forEach,
  };

  function ensureL1(k1: string): Map<string, T> {
    const maybeL1 = root.get(k1);
    if (maybeL1) {
      return maybeL1;
    }
    const l1 = new Map<string, T>();
    root.set(k1, l1);
    return l1;
  }

  function set(k1: string, k2: string, value: T): void {
    const l1 = ensureL1(k1);
    l1.set(k2, value);
    return;
  }

  function has(k1: string, k2: string): boolean {
    const l1 = root.get(k1);
    if (!l1) {
      return false;
    }
    if (l1.has(k2)) {
      return true;
    }
    return false;
  }

  function get(k1: string): Array<T>;
  function get(k1: string, k2: string): T | undefined;
  function get(k1: string, k2?: string): Array<T> | T | undefined {
    if (k2 === undefined) {
      const l1 = root.get(k1);
      if (!l1) {
        return [];
      }
      return Array.from(l1.values());
    }
    if (has(k1, k2)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return root.get(k1)!.get(k2)!;
    }
    return undefined;
  }

  function remove(k1: string, k2: string): void {
    if (!has(k1, k2)) {
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const l1 = root.get(k1)!;
    l1.delete(k2);
  }

  function forEach(callbackfn: (k1: string, k2: string, value: T) => void): void {
    root.forEach((l1, k1) => {
      l1.forEach((val, k2) => {
        callbackfn(k1, k2, val);
      });
    });
  }

  function cleanup() {
    const cleanupQueue: Array<string> = [];
    root.forEach((l1, k1) => {
      if (l1.size === 0) {
        cleanupQueue.push(k1);
      }
    });
    cleanupQueue.forEach((k1) => {
      root.delete(k1);
    });
  }
}
