import { Timestamp } from './Timestamp';
import { CLOCK_PRECISION, MERKLE_KEY_LENGTH } from './constants';

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
  const hash = timestamp.hash;
  const key = (timestamp.millis / CLOCK_PRECISION).toString(3);
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
    const keyset = new Set([...getKeys(node1), ...getKeys(node2)]);
    const keys = Array.from(keyset);
    keys.sort();

    const diffkey = keys.find((key) => {
      const next1 = node1[key] || {};
      const next2 = node2[key] || {};
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
  const fullkey = key + '0'.repeat(MERKLE_KEY_LENGTH - key.length);

  // Parse the base 3 representation
  return parseInt(fullkey, 3) * CLOCK_PRECISION;
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

/* istanbul ignore next */
function debug(trie?: MerkleTree, k: string = '', indent: number = 0): string {
  if (!trie) {
    return '';
  }
  const str = ' '.repeat(indent) + (k !== '' ? `k: ${k} ` : '') + `hash: ${trie.hash || '(empty)'}\n`;
  return (
    str +
    getKeys(trie)
      .map((key) => {
        return debug(trie[key], key, indent + 2);
      })
      .join('')
  );
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
