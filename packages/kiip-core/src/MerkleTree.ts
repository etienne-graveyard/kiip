import { Timestamp } from './Timestamp';

type MerkleTreeKey = '0' | '1' | '2';

export interface MerkleTree {
  hash?: number;
  '0'?: MerkleTree;
  '1'?: MerkleTree;
  '2'?: MerkleTree;
}

export const MerkleTree = {
  insert,
  diff,
  debug,
};

function insert(trie: MerkleTree, timestamp: Timestamp): MerkleTree {
  let hash = timestamp.hash;
  let key = Number((timestamp.millis / 1000 / 60) | 0).toString(3);
  const nextTrie = { ...trie, hash: (trie.hash || 0) ^ hash };
  return insertKey(nextTrie, key, hash);
}

function diff(trie1: MerkleTree, trie2: MerkleTree): number | null {
  if (trie1.hash === trie2.hash) {
    return null;
  }

  let node1 = trie1;
  let node2 = trie2;
  let k = '';

  while (1) {
    let keyset = new Set([...getKeys(node1), ...getKeys(node2)]);
    let keys = Array.from(keyset);
    keys.sort();

    // eslint-disable-next-line no-loop-func
    let diffkey = keys.find((key) => {
      let next1 = node1[key] || {};
      let next2 = node2[key] || {};
      return next1.hash !== next2.hash;
    });

    if (!diffkey) {
      return keyToTimestamp(k);
    }

    k += diffkey;
    node1 = node1[diffkey] || {};
    node2 = node2[diffkey] || {};
  }
  // eslint-disable-next-line no-unreachable
  throw new Error(`Unreachable`);
}

function getKeys(trie: MerkleTree): Array<MerkleTreeKey> {
  return Object.keys(trie).filter((x) => x !== 'hash') as any;
}

function keyToTimestamp(key: string): number {
  // 16 is the length of the base 3 value of the current time in
  // minutes. Ensure it's padded to create the full value
  let fullkey = key + '0'.repeat(16 - key.length);

  // Parse the base 3 representation
  return parseInt(fullkey, 3) * 1000 * 60;
}

function insertKey(trie: MerkleTree, key: string, hash: number): MerkleTree {
  if (key.length === 0) {
    return trie;
  }
  const c: MerkleTreeKey = key[0] as any;
  const n = trie[c] || {};
  return {
    ...trie,
    [c]: {
      ...n,
      ...insertKey(n, key.slice(1), hash),
      hash: (n.hash || 0) ^ hash,
    },
  };
}

// function build(timestamps: Array<Timestamp>): MerkleTree {
//   let trie: MerkleTree = {};
//   for (let timestamp of timestamps) {
//     insert(trie, timestamp);
//   }
//   return trie;
// }

// function prune(trie: MerkleTree, n: number = 2): MerkleTree {
//   // Do nothing if empty
//   if (!trie[HASH]) {
//     return trie;
//   }

//   const keys = getKeys(trie);
//   keys.sort();

//   let next: MerkleTree = { [HASH]: trie[HASH] };
//   keys.slice(-n).map((k) => (next[k] = prune(trie[k], n)));

//   return next;
// }

function debug(trie: MerkleTree, k: string = '', indent: number = 0): string {
  const str = ' '.repeat(indent) + (k !== '' ? `k: ${k} ` : '') + `hash: ${trie.hash || '(empty)'}\n`;
  return (
    str +
    getKeys(trie)
      .map((key) => {
        return debug(trie[key]!, key, indent + 2);
      })
      .join('')
  );
}
