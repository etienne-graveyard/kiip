import { MurmurHashHex } from './MurmurHash';

// (null is empty tree)
export type MerkleSearchTree = MSTNode | null;

export type MSTList = Array<MSTLeaf | MSTNode>;

export type MSTNode = {
  readonly key: string;
  readonly sub: MSTList;
  readonly lvl: number;
};

export type MSTLeaf = string;

export const MerkleSearchTree = {
  create,
  insert,
  findMaxLevel,
  debug,
};

function create(): MerkleSearchTree {
  return null;
}

function insert(tree: MerkleSearchTree, value: string): MerkleSearchTree {
  if (tree === null) {
    return createNodeFromItem(value);
  }
  const valueLeaf = createNodeFromItem(value);
  const maxLevel = Math.max(tree.lvl, valueLeaf.lvl);
  const baseTree = normalizeDepth(tree, maxLevel);

  let current = valueLeaf;

  for (let i = valueLeaf.lvl; i <= baseTree.lvl; i++) {
    const mergeWith = getLevel(baseTree, value, i);
    if (mergeWith === null) {
      current = createNodeFromItem(current);
    } else {
      const nextChildren = insertInList(mergeWith.sub, current.sub[0]);
      current = {
        lvl: mergeWith.lvl,
        sub: nextChildren,
        key: listHash(nextChildren),
      };
    }
  }
  return current;
}

function normalizeDepth(tree: MSTNode, level: number): MSTNode {
  if (tree.lvl > level) {
    throw new Error('Cannot reduce the max level');
  }
  let current: MSTNode = tree;
  for (let i = tree.lvl; i <= level; i++) {
    current = createNodeFromItem(current);
  }
  return current;
}

function createNodeFromItem(item: MSTNode | MSTLeaf): MSTNode {
  const level = isLeaf(item) ? levelFromKey(MurmurHashHex(item)) : item.lvl + 1;
  const children = [item];
  return {
    lvl: level,
    sub: children,
    key: listHash(children),
  };
}

function insertInList(list: MSTList, item: MSTLeaf | MSTNode): MSTList {
  const min = itemMin(item);
  const max = itemMax(item);
  if (min !== max) {
    throw new Error('Can only insert point, not ranges');
  }
  if (min < listMin(list)) {
    return [item, ...list];
  }
  if (max > listMax(list)) {
    return [...list, item];
  }
  const splitItem = list.find((a) => isNode(a) && min > itemMin(a) && max < itemMax(a));
  if (splitItem) {
    throw new Error('Todo: splot item');
  }
  let insertIndex = 0;
  while (itemMin(list[insertIndex]) < min) {
    insertIndex++;
  }
  const copy = [...list];
  copy.splice(insertIndex, 0, item);
  return copy;
}

function listHash(list: MSTList): string {
  return MurmurHashHex(list.map((v) => (isLeaf(v) ? v : v.key)).join(','));
}

function listMin(list: MSTList): string {
  const first = list[0];
  return itemMin(first);
}

function listMax(list: MSTList): string {
  const last = list[list.length - 1];
  return itemMax(last);
}

function itemMin(item: MSTLeaf | MSTNode): string {
  return isNode(item) ? listMin(item.sub) : item;
}

function itemMax(item: MSTLeaf | MSTNode): string {
  return isNode(item) ? listMax(item.sub) : item;
}

function getLevel(tree: MerkleSearchTree, value: string, level: number): MerkleSearchTree {
  if (tree === null) {
    return null;
  }
  let current = tree;
  while (current.lvl > level) {
    const nextItem = current.sub.find((item) => {
      if (isLeaf(item)) {
        return item === value;
      }
      return itemMin(item) >= value && itemMax(item) <= value;
    });
    if (!nextItem) {
      return null;
    }
    if (isLeaf(nextItem)) {
      console.warn('Value already in the tree ?');
      return null;
    }
    current = nextItem;
  }
  return current;
}

function findMaxLevel(tree: MSTLeaf | MerkleSearchTree): number {
  if (tree === null) {
    // empty
    return 0;
  }
  if (isNode(tree)) {
    return tree.lvl;
  }
  return levelFromKey(tree);
}

function isLeaf(item: MSTLeaf | MSTNode): item is MSTLeaf {
  return typeof item === 'string';
}

function isNode(item: MSTLeaf | MSTNode): item is MSTNode {
  return typeof item !== 'string';
}

function levelFromKey(key: string): number {
  let i = 0;
  while (key.charAt(i) === '0') {
    i++;
  }
  return i;
}

function debug(tree: MerkleSearchTree): string {
  if (tree === null) {
    return `[empty tree]`;
  }
  return [
    `> ${tree.key} (${tree.lvl})`,
    ...tree.sub
      .map((i) => (isLeaf(i) ? `- ${MurmurHashHex(i)} -> ${i}` : debug(i)))
      .map((v) =>
        v
          .split('\n')
          .map((l) => '  ' + l)
          .join('\n')
      ),
  ].join('\n');
}

// function insertInNode(node: MSTNode, item: MSTLeaf | MSTNode): MSTNode {
//   const nextChildren = insertInList(node.children, item);
//   return {
//     level: node.level,
//     children: nextChildren,
//     hash: listHash(nextChildren),
//   };
// }

// function normalizeTreesDepth(t1: MSTNode, t2: MSTNode): [MSTNode, MSTNode] {
//   const maxLevel = Math.max(findMaxLevel(t1), findMaxLevel(t2));
//   return [normalizeDepth(t1, maxLevel), normalizeDepth(t2, maxLevel)];
// }
