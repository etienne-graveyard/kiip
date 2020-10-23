import { HybridLogicalClock } from './HybridLogicalClock';
import { MurmurHash } from './MurmurHash';

export type MerkleTree = MTRootNode | null;

export type MTRootNode = MTNode & { base: string };

export type MTItem = string;

export type MTNodeKey = typeof NODE_KEYS extends ReadonlyArray<infer T>
  ? T
  : never;

export type MTLeaf = { readonly key: number; items: Array<MTItem> };

export type MTBranch = { readonly key: number } & { [K in MTNodeKey]?: MTNode };

export type MTNode = MTLeaf | MTBranch;

export type MTSyncMessageRequest = {
  type: 'Request';
  path: string | null; // path null is empty tree
  key: number | null; // key null if missing node
};

export type MTChildren = { [K in MTNodeKey]?: number } | Array<MTItem>;

export type MTSyncMessageResponse = {
  type: 'Response';
  path: string;
  key: number;
  children: MTChildren; // next level
};

export type MTSyncMessage = MTSyncMessageRequest | MTSyncMessageResponse;

export type MTHandleItemsResult = {
  added: Array<string> | null;
  tree: MerkleTree;
};

export type MTHandleMessageResult = {
  responses: Array<MTSyncMessage> | null;
  items: Array<string> | null;
};

const NODE_KEYS = ['0', '1', '2', '3'] as const;
const HLC = HybridLogicalClock.create();

export const MerkleTree = {
  build,
  insert,
  has,
  explode,
  prepareSync,
  handleMessage,
  handleItems,
  findNode,
};

function prepareSync(tree: MerkleTree): MTSyncMessageRequest {
  if (tree === null) {
    return {
      type: 'Request',
      path: null,
      key: null,
    };
  }
  return {
    type: 'Request',
    path: tree.base,
    key: tree.key,
  };
}

function handleItems(
  tree: MerkleTree,
  items: Array<MTItem>,
): MTHandleItemsResult {
  if (items.length === 0) {
    return { tree, added: null };
  }
  const added: Array<string> = [];
  let nextTree = tree;
  items.forEach((item) => {
    if (has(nextTree, item)) {
      return;
    }
    nextTree = insert(nextTree, item);
    added.push(item);
  });
  if (added.length === 0) {
    return { tree, added: null };
  }
  return { tree: nextTree, added };
}

function handleMessage(
  tree: MerkleTree,
  message: MTSyncMessageResponse | MTSyncMessageRequest,
): MTHandleMessageResult {
  if (message.type === 'Request') {
    return handleMessageRequest(tree, message);
  }
  if (message.type === 'Response') {
    return handleMessageResponse(tree, message);
  }
  throw new Error('Unhandled message type');
}

function handleMessageRequest(
  tree: MerkleTree,
  message: MTSyncMessageRequest,
): MTHandleMessageResult {
  if (message.path === null) {
    // requesting full tree
    if (tree === null) {
      // up-to-date (both empty)
      return { responses: null, items: null };
    }
    // remote is empty, send all values
    return { responses: null, items: explode(tree) };
  }
  const node = findNode(tree, message.path);
  return syncNode(message.path, message.key, node);
}

function handleMessageResponse(
  tree: MerkleTree,
  message: MTSyncMessageResponse,
): MTHandleMessageResult {
  const node = findNode(tree, message.path);
  if (!node) {
    throw new Error('We should have this node because we send it !');
  }
  if (node.key === message.key) {
    // up-to-date
    return { responses: null, items: null };
  }
  const children = getChildren(node);
  const remoteChildren = message.children;
  // diff children
  if (!Array.isArray(children) && !Array.isArray(remoteChildren)) {
    const diffKeys = NODE_KEYS.filter(
      (key) => remoteChildren[key] !== children[key],
    );
    if (diffKeys.length === 0) {
      throw new Error(
        'If children are the same the key should be the same too',
      );
    }
    const responses: Array<MTSyncMessage> = [];
    const items: Array<string> = [];
    diffKeys.forEach((key) => {
      const subPath = message.path + key;
      const subNode = findNode(tree, subPath);
      const subRemote = remoteChildren[key] ?? null;
      const subResult = syncNode(subPath, subRemote, subNode);
      if (subResult.items) {
        items.push(...subResult.items);
      }
      if (subResult.responses) {
        responses.push(...subResult.responses);
      }
    });
    return {
      responses: responses.length === 0 ? null : responses,
      items: items.length === 0 ? null : items,
    };
  }
  if (Array.isArray(children) && Array.isArray(remoteChildren)) {
    const localChildren = children.filter(
      (item) => !remoteChildren.includes(item),
    );
    const missingChildren = remoteChildren.filter(
      (item) => !children.includes(item),
    );
    if (localChildren.length === 0 && missingChildren.length === 0) {
      throw new Error(
        'If children are the same the key should be the same too',
      );
    }
    let responses: Array<MTSyncMessage> | null = null;
    if (missingChildren.length > 0) {
      responses = [
        {
          type: 'Response',
          children: localChildren,
          path: message.path,
          key: node.key,
        },
      ];
    }
    const items =
      localChildren.length === 0
        ? null
        : localChildren.map((counter) =>
            HLC.injectTime(timeBase4ToNumber(message.path), counter),
          );
    return { responses, items };
  }
  throw new Error('Children should have the same type');
}

function syncNode(
  path: string,
  remote: number | null,
  node: MTNode | null,
): MTHandleMessageResult {
  if (remote === null) {
    if (node === null) {
      // up-to-date (both empty)
      return { responses: null, items: null };
    }
    // remote is empty, send all values
    return { responses: null, items: explodeInternal(path, node) };
  }
  if (node === null) {
    // request entire node
    return { responses: [{ type: 'Request', path, key: null }], items: null };
  }
  if (node.key === remote) {
    // up-to-date
    return { responses: null, items: null };
  }
  return {
    responses: [
      { type: 'Response', path, key: node.key, children: getChildren(node) },
    ],
    items: [],
  };
}

function getChildren(node: MTNode): MTChildren {
  if (isLeaf(node)) {
    return node.items;
  }
  return NODE_KEYS.reduce<{ [K in MTNodeKey]?: number }>((acc, key) => {
    const sub = node[key];
    if (sub) {
      acc[key] = sub.key;
    }
    return acc;
  }, {});
}

function isLeaf(node: MTNode): node is MTLeaf {
  return 'items' in node;
}

function has(tree: MerkleTree, item: string): boolean {
  if (tree === null) {
    return false;
  }
  const [time, value] = HLC.extractTime(item);
  const key = timeNumberToBase4(time);
  if (!key.startsWith(tree.base)) {
    return false;
  }
  const relativeKey = key.slice(tree.base.length);
  let current: MTNode = tree;
  for (let i = 0; i < relativeKey.length; i++) {
    if ('items' in current) {
      throw new Error('Invalid tree ?');
    }
    const keyChar = relativeKey[i] as MTNodeKey;
    const sub = current[keyChar];
    if (!sub) {
      return false;
    }
    current = sub;
  }
  if (!('items' in current)) {
    throw new Error('Invalid tree ?');
  }
  return current.items.includes(value);
}

function explode(tree: MerkleTree): Array<string> {
  if (tree === null) {
    return [];
  }
  return explodeInternal(tree.base, tree);
}

function explodeInternal(base: string, node: MTNode): Array<string> {
  if ('items' in node) {
    return node.items.map((i) => HLC.injectTime(timeBase4ToNumber(base), i));
  }
  return ['0', '1', '2', '3'].reduce<Array<string>>((acc, keyChar) => {
    const sub = node[keyChar as MTNodeKey];
    if (sub) {
      return acc.concat(explodeInternal(base + keyChar, sub));
    }
    return acc;
  }, []);
}

function insert(tree: MerkleTree, item: string): MerkleTree {
  if (tree === null) {
    return build(item);
  }
  if (has(tree, item)) {
    return tree;
  }
  return build(...explode(tree), item);
}

function findNode(tree: MerkleTree, path: string | null): MTNode | null {
  if (tree === null) {
    return null;
  }
  if (path === null) {
    return tree;
  }
  if (path.startsWith(tree.base) === false) {
    return null;
  }
  const pathQueue = path.slice(tree.base.length).split('') as Array<MTNodeKey>;
  let current: MTNode = tree;
  while (pathQueue.length > 0) {
    const keyChar = pathQueue.shift();
    if (!keyChar) {
      throw new Error('What ?');
    }
    if ('items' in current) {
      throw new Error('What ?');
    }
    const next = current[keyChar];
    if (!next) {
      return null;
    }
    current = next;
  }
  return current;
}

function build(...items: Array<string>): MerkleTree {
  if (items.length === 0) {
    return null;
  }
  const itemsParsed = Array.from(new Set(items)).map((item) => {
    const [time, value] = HLC.extractTime(item);
    return {
      time: timeNumberToBase4(time),
      value,
    };
  });
  const timeGroups = groupArrayBy(
    itemsParsed,
    (item) => item.time,
    (item) => item.value,
  );

  const timeGroupsArr = Object.entries(timeGroups);
  if (timeGroupsArr.length === 1) {
    const [base, items] = timeGroupsArr[0];
    return {
      base,
      items,
      key: listHash(items),
    };
  }
  let nodes = mapObject(
    timeGroups,
    (items): MTNode => ({
      items,
      key: listHash(items),
    }),
  );
  while (Object.keys(nodes).length > 1) {
    const group = groupNodes(nodes);
    nodes = mapObject(group, (v): MTNode => ({ ...v, key: subsHash(v) }));
  }
  const [base, root] = Object.entries(nodes)[0];

  return {
    base,
    ...root,
  };
}

function groupNodes<T>(obj: {
  [key: string]: T;
}): { [key: string]: { [K in MTNodeKey]?: T } } {
  const result: { [key: string]: { [K in MTNodeKey]?: T } } = {};
  Object.entries(obj).forEach(([key, value]) => {
    const base = key.slice(0, -1);
    const sub = key.slice(-1);
    if (sub !== '0' && sub !== '1' && sub !== '2' && sub !== '3') {
      throw new Error('Invalid key');
    }
    if (!result[base]) {
      result[base] = { [sub]: value };
      return;
    }
    if (result[base][sub]) {
      throw new Error('Sub already defined ?');
    }
    result[base][sub] = value;
  });
  return result;
}

// 32 bit int to base 4 (16 char)
function timeNumberToBase4(time: number): string {
  return ('0'.repeat(16) + time.toString(4)).slice(-16);
}

function timeBase4ToNumber(time: string): number {
  return parseInt(time, 4);
}

function listHash(list: Array<string>): number {
  return list.reduce((acc, str) => acc ^ MurmurHash(str), 0);
}

function subsHash(obj: { [K in MTNodeKey]?: MTNode }): number {
  return (
    (obj['0']?.key ?? 0) ^
    (obj['1']?.key ?? 0) ^
    (obj['2']?.key ?? 0) ^
    (obj['3']?.key ?? 0)
  );
}

function groupArrayBy<T, U>(
  arr: Array<T>,
  getKey: (value: T) => string,
  mapValue: (val: T) => U,
): { [key: string]: Array<U> } {
  const result: { [key: string]: Array<U> } = {};
  arr.forEach((item) => {
    const nextKey = getKey(item);
    if (!result[nextKey]) {
      result[nextKey] = [mapValue(item)];
      return;
    }
    result[nextKey].push(mapValue(item));
  });
  return result;
}

function mapObject<T, U>(
  obj: { [key: string]: T },
  mapValue: (val: T, key: string) => U,
): { [key: string]: U } {
  return Object.entries(obj)
    .map(([key, value]) => [key, mapValue(value, key)] as const)
    .reduce<{ [key: string]: U }>((acc, [k, v]) => {
      acc[k] = v;
      return acc;
    }, {});
}
