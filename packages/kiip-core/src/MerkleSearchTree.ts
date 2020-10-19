/* eslint-disable @typescript-eslint/no-unused-vars */
import { MurmurHash } from './MurmurHash';

// (null is empty tree)
export type MerkleSearchTree = MSTNode | null;

export type MSTList = Array<MSTLeaf | MSTNode>;

export type MSTNode = {
  readonly key: number;
  readonly sub: MSTList;
};

export type MSTLeaf = string;

export const MerkleSearchTree = {
  create,
  insert,
  findRootLayer,
  debug,
  build,
};

function create(): MerkleSearchTree {
  return null;
}

function insert(tree: MerkleSearchTree, value: string): MerkleSearchTree {
  const valueKey = MurmurHash(value);
  if (tree === null) {
    return { sub: [value], key: valueKey };
  }
  const baseTree = tree;
  const valueLayer = layerFromKey(valueKey);
  const treeLayer = findRootLayer(tree);

  if (valueLayer === treeLayer) {
    return {
      key: tree.key ^ valueKey,
      sub: insertInList(tree.sub, value),
    };
  }

  if (valueLayer > treeLayer) {
    let [low, high] = splitTree(tree, value);
    for (let layer = treeLayer; layer < valueLayer - 1; layer++) {
      if (low) {
        low = { key: low.key, sub: [low] };
      }
      if (high) {
        high = { key: high.key, sub: [high] };
      }
    }
    return {
      sub: low && high ? [low, value, high] : low ? [low, value] : high ? [value, high] : [value],
      key: (low?.key ?? 0) ^ valueKey ^ (high?.key ?? 0),
    };
  }

  if (valueLayer < treeLayer) {
    return insertInLevel(tree, treeLayer, value, valueLayer, valueKey);
  }

  // return buildLayer(rootLayer);

  // const baseTree = normalizeDepth(tree, maxDepth);
  // const baseTreeDepth = findDepth(baseTree);
  // console.log('====');

  // console.log(debug(valueTree));
  // console.log(debug(baseTree));
  // console.log({ baseTreeLvl: baseTreeDepth });

  // function insertAt(tree: MSTNode, currentDepth: number): MerkleSearchTree {
  //   if (currentDepth === valueTreeDepth) {
  //     return {
  //       key: tree.key ^ valueTree.key,
  //       sub: insertInList(tree.sub, value),
  //     };
  //   }
  //   // should we split ?
  //   // const splitItem = tree.sub.find((a) => isNode(a) && value > itemMin(a) && value < itemMax(a));
  //   // console.log({ splitItem });
  //   return tree;
  // }

  // return insertAt(baseTree, valueTreeDepth);

  // let current = valueLeaf;
  // const mergeWith = getLevel(baseTree, value, valueLeafLvl);
  // if (mergeWith === null) {
  //   current = createNodeFromItem(current);
  // } else {
  //   const item = current.sub[0];
  //   const itemHash = isLeaf(item) ? MurmurHash(item) : item.key;
  //   console.log(debug(mergeWith));
  //   console.log(debug(item));
  //   const nextChildren = insertInList(mergeWith.sub, item);
  //   current = {
  //     sub: nextChildren,
  //     key: mergeWith.key ^ itemHash,
  //   };
  // }
  // for (let i = valueLeafLvl + 1; i <= baseTreeLvl; i++) {
  //   const levelTree = getLevel(baseTree, value, i);
  //   console.log('TODO: rebuild level', i);
  //   console.log(debug(levelTree));
  //   console.log(debug(current));
  // }
  return baseTree;
}

function splitTree(tree: MSTNode, value: MSTLeaf): [MerkleSearchTree, MerkleSearchTree] {
  const min = itemMin(tree);
  const max = itemMax(tree);
  if (value < min) {
    return [null, tree];
  }
  if (value > max) {
    return [tree, null];
  }
  const [low, high] = splitList(tree.sub, value);
  return [
    {
      key: computeListKey(low),
      sub: low,
    },
    {
      key: computeListKey(high),
      sub: high,
    },
  ];
}

function splitList(list: MSTList, value: MSTLeaf): [MSTList, MSTList] {
  const splitItem = findIntersectingItem(list, value);
  if (splitItem) {
    const splitIndex = list.indexOf(splitItem);
    const before = list.slice(0, splitIndex);
    const after = list.slice(splitIndex + 1);
    const [beforeItem, afterItem] = splitTree(splitItem, value);
    if (beforeItem === null || afterItem === null) {
      throw new Error('What ?');
    }
    const low: MSTList = [...before, beforeItem];
    const high: MSTList = [afterItem, ...after];
    return [low, high];
  }
  // just split in two
  let splitIndex = 0;
  while (itemMax(list[splitIndex]) < value) {
    splitIndex++;
  }
  return [list.slice(0, splitIndex), list.slice(splitIndex)];
}

function findIntersectingItem(list: MSTList, value: MSTLeaf): MSTNode | null {
  const splitItem = list.find((a) => isNode(a) && value > itemMin(a) && value < itemMax(a));
  if (!splitItem) {
    return null;
  }
  if (isLeaf(splitItem)) {
    throw new Error('What ?');
  }
  return splitItem;
}

function computeListKey(list: MSTList): number {
  return list.reduce((acc, item) => {
    return acc ^ (isLeaf(item) ? MurmurHash(item) : item.key);
  }, 0);
}

function insertInLevel(
  tree: MSTNode,
  treeLayer: number,
  value: MSTLeaf,
  valueLayer: number,
  valueKey: number
): MSTNode {
  if (treeLayer === valueLayer) {
    const newList = insertInList(tree.sub, value);
    return {
      key: tree.key ^ valueKey,
      sub: newList,
    };
  }
  const insertSub = findIntersectingItem(tree.sub, value);
  if (!insertSub) {
    const next = createNodeWithRootLayerOf(value, valueLayer, valueKey, treeLayer - 1);
    return {
      key: tree.key ^ valueKey,
      sub: insertInList(tree.sub, next),
    };
  }
  const next = insertInLevel(insertSub, treeLayer - 1, value, valueLayer, valueKey);
  const insertSubIndex = tree.sub.indexOf(insertSub);
  return {
    key: tree.key ^ valueKey,
    sub: replaceAtIndex(tree.sub, insertSubIndex, next),
  };
}

function replaceAtIndex<T>(list: Array<T>, index: number, value: T): Array<T> {
  return [...list.slice(0, index), value, ...list.slice(index + 1)];
}

// function normalizeDepth(tree: MSTNode, level: number): MSTNode {
//   const treeLvl = findDepth(tree);
//   if (treeLvl > level) {
//     throw new Error('Cannot reduce the max level');
//   }
//   let current: MSTNode = tree;
//   for (let i = treeLvl; i <= level; i++) {
//     current = createNodeFromItem(current);
//   }
//   return current;
// }

// function createNodeFromItem(item: MSTNode | MSTLeaf): MSTNode {
//   const children = [item];
//   return {
//     sub: children,
//     key: isLeaf(item) ? MurmurHash(item) : item.key,
//   };
// }

function createNodeWithRootLayerOf(value: string, valueLayer: number, valueKey: number, rootLayer: number): MSTNode {
  let current: MSTNode = {
    key: valueKey,
    sub: [value],
  };
  for (let layer = valueLayer; layer < rootLayer; layer++) {
    current = {
      key: valueKey,
      sub: [current],
    };
  }
  return current;
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
    console.log(debug(item));
    console.log(debug(splitItem));

    console.log({ splitItem, item });

    throw new Error('Todo: split item');
  }
  let insertIndex = 0;
  while (itemMin(list[insertIndex]) < min) {
    insertIndex++;
  }
  const copy = [...list];
  copy.splice(insertIndex, 0, item);
  return copy;
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

// @ts-expect-error temp
function getLayer(tree: MSTNode, value: string, targetLayer: number): MSTNode {
  const treeRootLayer = findRootLayer(tree);
  if (targetLayer > treeRootLayer) {
    throw new Error('targetLayer bigger than tree layer');
  }
  let current = tree;
  for (let layer = treeRootLayer; layer < targetLayer; layer++) {
    const nextItem = current.sub.find((item) => {
      if (isLeaf(item)) {
        return item === value;
      }
      return itemMin(item) >= value && itemMax(item) <= value;
    });
    if (!nextItem) {
      throw new Error('Layer not found ?');
    }
    if (isLeaf(nextItem)) {
      throw new Error('Value already in the tree ?');
    }
    current = nextItem;
  }
  return current;
}

function findRootLayer(tree: MerkleSearchTree): number {
  if (tree === null) {
    // empty
    return 0;
  }
  const item = tree.sub.find((i) => isLeaf(i));
  if (item) {
    if (!isLeaf(item)) {
      throw new Error('What ?');
    }
    return layerFromKey(MurmurHash(item));
  }
  const first = tree.sub[0];
  if (!isNode(first)) {
    throw new Error('What ?');
  }
  return findRootLayer(first) + 1;
}

function isLeaf(item: MSTLeaf | MSTNode): item is MSTLeaf {
  return typeof item === 'string';
}

function isNode(item: MSTLeaf | MSTNode): item is MSTNode {
  return typeof item !== 'string';
}

function layerFromKey(key: number): number {
  const hexKey = hashToHex(key);
  let i = 0;
  while (hexKey.charAt(i) === '0') {
    i++;
  }
  return i;
}

function hashToHex(key: number): string {
  return ('00000000' + key.toString(16)).slice(-8);
}

function last<T>(arr: Array<T>): T {
  return arr[arr.length - 1];
}

function build(...values: Array<MSTLeaf>): MerkleSearchTree {
  if (values.length === 0) {
    return null;
  }
  const root: MSTNode = { sub: [], key: 0 };
  const maxLayer = Math.max(...values.map((value) => layerFromKey(MurmurHash(value))));
  [...values].sort().forEach((value) => {
    const depth = maxLayer - layerFromKey(MurmurHash(value));
    let current = root;
    for (let d = 0; d < depth; d++) {
      let next = last(current.sub);
      if (next === undefined || isLeaf(next)) {
        next = { sub: [], key: 0 };
        current.sub.push(next);
      }
      current = next;
    }
    current.sub.push(value);
  });
  function withKeys(tree: MSTNode): MSTNode {
    let key = 0;
    const subs = tree.sub.map((item) => {
      if (isNode(item)) {
        const sub = withKeys(item);
        key = key ^ sub.key;
        return sub;
      }
      key = key ^ MurmurHash(item);
      return item;
    });
    return {
      sub: subs,
      key,
    };
  }
  return withKeys(root);
}

function debug(tree: MerkleSearchTree | MSTLeaf): string {
  if (tree === null) {
    return `[empty tree]`;
  }
  if (isLeaf(tree)) {
    return `- ${hashToHex(MurmurHash(tree))} -> ${tree}`;
  }
  return [
    `> ${hashToHex(tree.key)} (${findRootLayer(tree)})`,
    ...tree.sub
      .map((i) => debug(i))
      .map((v) =>
        v
          .split('\n')
          .map((l) => '  ' + l)
          .join('\n')
      ),
  ].join('\n');
}

// function check(tree: MerkleSearchTree): void {
//   if (tree === null) {
//     return;
//   }
//   function checkInternal(tree: MSTNode, path: Array<number>): void {
//     const depth = path.length;
//     const hash = tree.sub.reduce((acc, item, index) => {
//       const currentPath = [...path, index];
//       if (isLeaf(item)) {
//         const key = MurmurHash(item);
//         const expectedDepth = levelFromKey(hashToHex(key));
//         if (expectedDepth !== depth) {
//           throw new Error(
//             `Invalid depth in ${currentPath.join('>')} (expected ${expectedDepth}, got ${depth}), ${hashToHex(key)}`
//           );
//         }
//         return acc ^ key;
//       }
//       checkInternal(item, currentPath);
//       return acc ^ item.key;
//     }, 0);
//     if (hash !== tree.key) {
//       throw new Error(`Invalid key in ${path.join('>')}`);
//     }
//   }
//   return checkInternal(tree, []);
// }

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
