import { MurmurHash } from './MurmurHash';
import { Timestamp, TimestampWithConfig } from './Timestamp';

export type MerkleTreeRoot = MerkleTreeRootNode | null;
export type MerkleTreeRootNode = MerkleTreeNode & { base: string };
export type MerkleTreeNodeKey = typeof NODE_KEYS extends ReadonlyArray<infer T> ? T : never;
export type MerkleTreeLeaf = { readonly key: number; items: Array<string> };
export type MerkleTreeBranch = { readonly key: number } & { [K in MerkleTreeNodeKey]?: MerkleTreeNode };
export type MerkleTreeChildren = { [K in MerkleTreeNodeKey]?: number } | Array<string>;
export type MerkleTreeNode = MerkleTreeLeaf | MerkleTreeBranch;

export type MerkleTreeSyncRootBase = {
  type: 'RootBase';
  base: string;
  key: number;
};

export type MerkleTreeSyncRequest = {
  type: 'Request';
  path: string;
  key: number | null; // key null if missing node
};

export type MerkleTreeSyncResponse = {
  type: 'Response';
  path: string;
  key: number;
  children: MerkleTreeChildren;
};

export type MerkleTreeSyncMessage = MerkleTreeSyncRequest | MerkleTreeSyncResponse | MerkleTreeSyncRootBase;

export type MerkleTreeHandleItemsResult = {
  added: Array<Timestamp> | null;
  tree: MerkleTreeRoot;
};

export type MerkleTreeHandleSyncResult = {
  responses: Array<MerkleTreeSyncMessage> | null;
  items: Array<Timestamp> | null;
};

const NODE_KEYS = ['0', '1', '2', '3'] as const;

export type MerkleTreeConfig = {
  Timestamp: TimestampWithConfig;
};

const DEFAULT_CONFIG: Readonly<Required<MerkleTreeConfig>> = {
  Timestamp: Timestamp.withConfig(),
};

export class MerkleTree {
  readonly config: Required<MerkleTreeConfig>;

  constructor(config: Partial<MerkleTreeConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  prepareSync(root: MerkleTreeRoot): MerkleTreeSyncRequest | MerkleTreeSyncRootBase {
    if (root === null) {
      // local is empty, just request root path
      return {
        type: 'Request',
        path: '',
        key: null,
      };
    }
    // send local root base and key
    return {
      type: 'RootBase',
      base: root.base,
      key: root.key,
    };
  }

  handleItems(root: MerkleTreeRoot, items: Array<Timestamp>): MerkleTreeHandleItemsResult {
    if (items.length === 0) {
      return { tree: root, added: null };
    }
    const added: Array<Timestamp> = [];
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let nextRoot: MerkleTreeRoot = root;
    items.forEach((item) => {
      if (this.has(nextRoot, item)) {
        console.log('Already has ' + item.toString());
        return;
      }
      nextRoot = this.insert(nextRoot, item);
      added.push(item);
    });
    if (added.length === 0) {
      return { tree: root, added: null };
    }
    return { tree: nextRoot, added };
  }

  has(root: MerkleTreeRoot, item: Timestamp): boolean {
    if (root === null) {
      return false;
    }
    // const [time, value] = HLC.extractTime(item);
    const key = timeNumberToBase4(item.time);
    if (!key.startsWith(root.base)) {
      return false;
    }
    const relativeKey = key.slice(root.base.length);
    let current: MerkleTreeNode = root;
    for (let i = 0; i < relativeKey.length; i++) {
      if ('items' in current) {
        throw new Error('Invalid tree ?');
      }
      const keyChar = relativeKey[i] as MerkleTreeNodeKey;
      const sub = current[keyChar];
      if (!sub) {
        return false;
      }
      current = sub;
    }
    if (!('items' in current)) {
      throw new Error('Invalid tree ?');
    }
    return current.items.includes(item.idCounter);
  }

  explode(root: MerkleTreeRoot): Array<Timestamp> {
    if (root === null) {
      return [];
    }
    return this.explodeInternal(root.base, root);
  }

  insert(root: MerkleTreeRoot, item: Timestamp): MerkleTreeRoot {
    if (root === null) {
      return this.from([item]);
    }
    if (this.has(root, item)) {
      return root;
    }
    return this.from([...this.explode(root), item]);
  }

  handleSync(root: MerkleTreeRoot, message: MerkleTreeSyncMessage): MerkleTreeHandleSyncResult {
    if (message.type === 'RootBase') {
      return this.handleSyncRootBase(root, message);
    }
    if (message.type === 'Request') {
      return this.handleSyncRequest(root, message);
    }
    if (message.type === 'Response') {
      return this.handleSyncResponse(root, message);
    }
    throw new Error('Unhandled message type');
  }

  private handleSyncRootBase(root: MerkleTreeRoot, message: MerkleTreeSyncRootBase): MerkleTreeHandleSyncResult {
    if (root === null) {
      return { items: null, responses: [{ type: 'Request', path: '', key: null }] };
    }
    if (message.base === root.base) {
      if (message.key === root.key) {
        return { items: null, responses: null };
      }
      return {
        items: null,
        responses: [{ type: 'Response', path: root.base, key: root.key, children: getChildren(root) }],
      };
    }
    // find common base
    let commonBase = '';
    let index = 0;
    while (
      index < message.base.length &&
      index < root.base.length &&
      message.base.charAt(index) === root.base.charAt(index)
    ) {
      commonBase += root.base.charAt(index);
      index++;
    }
    const found = this.findNode(root, commonBase);
    return { items: null, responses: [{ type: 'Request', path: commonBase, key: found ? found.node.key : null }] };
  }

  private handleSyncRequest(root: MerkleTreeRoot, message: MerkleTreeSyncRequest): MerkleTreeHandleSyncResult {
    // remote send a path and a key
    return this.syncNode(root, message.path, message.key);
  }

  private handleSyncResponse(root: MerkleTreeRoot, message: MerkleTreeSyncResponse): MerkleTreeHandleSyncResult {
    // remote is sending it's children at message.path
    const found = this.findNode(root, message.path);
    if (!found) {
      throw new Error('We should have this node because we send it !');
    }
    // if (found.path !== message.path) {
    //   throw new Error('We should have this node because we send it (not the same path) !');
    // }
    const { node } = found;
    if (node.key === message.key) {
      // up-to-date
      return { responses: null, items: null };
    }
    // diff children
    const children = getChildren(node);
    const remoteChildren = message.children;
    if (!Array.isArray(children) && !Array.isArray(remoteChildren)) {
      // diff node children
      const diffKeys = NODE_KEYS.filter((key) => remoteChildren[key] !== children[key]);
      if (diffKeys.length === 0) {
        throw new Error('If children are all the same the parent key should be the same too');
      }
      const responses: Array<MerkleTreeSyncMessage> = [];
      const items: Array<Timestamp> = [];
      diffKeys.forEach((key) => {
        const subPath = message.path + key;
        // const subNode = this.findNode(subPath);
        const subRemote = remoteChildren[key] ?? null;
        const subResult = this.syncNode(root, subPath, subRemote);
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
      // diff values (leafs)
      const localChildren = children.filter((item) => !remoteChildren.includes(item));
      const missingChildren = remoteChildren.filter((item) => !children.includes(item));
      if (localChildren.length === 0 && missingChildren.length === 0) {
        throw new Error('If children are the same the key should be the same too');
      }
      let responses: Array<MerkleTreeSyncMessage> | null = null;
      if (missingChildren.length > 0) {
        responses = [{ type: 'Response', children: localChildren, path: message.path, key: node.key }];
      }
      const items: Array<Timestamp> = localChildren.map((idCounter) =>
        this.config.Timestamp.parse({ time: timeBase4ToNumber(message.path), idCounter })
      );
      return { responses, items: items.length === 0 ? null : items };
    }
    throw new Error('Children should have the same type');
  }

  private syncNode(root: MerkleTreeRoot, path: string, remoteKey: number | null): MerkleTreeHandleSyncResult {
    const found = this.findNode(root, path);
    if (remoteKey === null) {
      // remote has nothing at this node
      if (found === null) {
        // local is empty, this path is up to date
        return { responses: null, items: null };
      }
      // remote is empty, bu local is not, send local item
      return { responses: null, items: this.explodeInternal(found.path, found.node) };
    }
    // remote is not empty
    if (found === null) {
      // local is empty, let's request the path
      return { responses: [{ type: 'Request', path, key: null }], items: null };
    }
    if (found.node.key === remoteKey) {
      // up-to-date
      return { responses: null, items: null };
    }
    // local node and remote node are differents
    if (found.path === path) {
      // same path, we respond with children
      return {
        responses: [{ type: 'Response', path: path, key: found.node.key, children: getChildren(found.node) }],
        items: null,
      };
    }
    // local node is deeper, we create children from found path
    const subKey = found.path.charAt(path.length) as MerkleTreeNodeKey;
    return {
      responses: [{ type: 'Response', path: path, key: found.node.key, children: { [subKey]: found.node.key } }],
      items: null,
    };
  }

  private findNode(root: MerkleTreeRoot, path: string): { node: MerkleTreeNode; path: string } | null {
    if (root === null) {
      return null;
    }
    if (path.length <= root.base.length) {
      // path is 01 or 00, base is 000
      if (root.base.startsWith(path)) {
        // this also cover the case where path === base
        return { node: root, path: root.base }; // return root because 000 is like 00->0
      }
      return null;
    }
    // path is 000 or 010, base is 00
    // requested path is more precise
    // requested is either inside or outside
    if (path.startsWith(root.base) === false) {
      // outside
      return null;
    }
    // search in tree
    const pathQueue = path.slice(root.base.length).split('') as Array<MerkleTreeNodeKey>;
    let current: MerkleTreeNode = root;
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
    return { node: current, path };
  }

  private explodeInternal(base: string, node: MerkleTreeNode): Array<Timestamp> {
    if ('items' in node) {
      return node.items.map((idCounter) => this.config.Timestamp.parse({ time: timeBase4ToNumber(base), idCounter }));
    }
    return ['0', '1', '2', '3'].reduce<Array<Timestamp>>((acc, keyChar) => {
      const sub = node[keyChar as MerkleTreeNodeKey];
      if (sub) {
        return acc.concat(this.explodeInternal(base + keyChar, sub));
      }
      return acc;
    }, []);
  }

  toString(root: MerkleTreeRoot): string {
    if (root === null) {
      return '[EMPTY]';
    }
    const handleNode = (node: MerkleTreeNode, depth: number): Array<string> => {
      if (isLeaf(node)) {
        return ['  '.repeat(depth) + node.items.join(',')];
      }
      return NODE_KEYS.reduce<Array<string>>((acc, key) => {
        const child = node[key];
        if (!child) {
          return acc;
        }
        acc.push('  '.repeat(depth) + key);
        acc.push(...handleNode(child, depth + 1));
        return acc;
      }, []);
    };
    return [root.base, ...handleNode(root, 1)].join('\n');
  }

  toJSON(root: MerkleTreeRoot): unknown {
    if (root === null) {
      return null;
    }
    const handleNode = (node: MerkleTreeNode): unknown => {
      if (isLeaf(node)) {
        return node.items;
      }
      return NODE_KEYS.reduce<{ [K in MerkleTreeNodeKey]?: unknown }>((acc, key) => {
        const sub = node[key];
        if (sub) {
          acc[key] = handleNode(sub);
        }
        return acc;
      }, {});
    };
    return handleNode(root);
  }

  empty(): MerkleTreeRoot {
    return null;
  }

  from(timestamps: Array<Timestamp>): MerkleTreeRoot {
    if (timestamps.length === 0) {
      return null;
    }
    const handled = new Set<string>();
    const itemsParsed: Array<{ time: string; value: string }> = [];
    timestamps.forEach((item) => {
      if (handled.has(item.toString())) {
        return;
      }
      handled.add(item.toString());
      itemsParsed.push({
        time: timeNumberToBase4(item.time),
        value: item.idCounter,
      });
    });
    const timeGroups = groupArrayBy(
      itemsParsed,
      (item) => item.time,
      (item) => item.value
    );
    const timeGroupsArr = Object.entries(timeGroups);
    if (timeGroupsArr.length === 1) {
      const [base, items] = timeGroupsArr[0];
      return { base, items, key: listHash(base, items) };
    }
    let nodes = mapObject(timeGroups, (items, base): MerkleTreeNode => ({ items, key: listHash(base, items) }));
    while (Object.keys(nodes).length > 1) {
      const group = groupNodes(nodes);
      nodes = mapObject(group, (v): MerkleTreeNode => ({ ...v, key: subsHash(v) }));
    }
    const [base, root] = Object.entries(nodes)[0];
    return { base, ...root };
  }

  static readonly DEFAULT_CONFIG = DEFAULT_CONFIG;
}

function getChildren(node: MerkleTreeNode): MerkleTreeChildren {
  if (isLeaf(node)) {
    return node.items;
  }
  return NODE_KEYS.reduce<{ [K in MerkleTreeNodeKey]?: number }>((acc, key) => {
    const sub = node[key];
    if (sub) {
      acc[key] = sub.key;
    }
    return acc;
  }, {});
}

function isLeaf(node: MerkleTreeNode): node is MerkleTreeLeaf {
  return 'items' in node;
}

function groupNodes<T>(obj: { [key: string]: T }): { [key: string]: { [K in MerkleTreeNodeKey]?: T } } {
  const result: { [key: string]: { [K in MerkleTreeNodeKey]?: T } } = {};
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

function listHash(base: string, list: Array<string>): number {
  return list.reduce((acc, str) => acc ^ MurmurHash(base + str), 0);
}

function subsHash(obj: { [K in MerkleTreeNodeKey]?: MerkleTreeNode }): number {
  return (obj['0']?.key ?? 0) ^ (obj['1']?.key ?? 0) ^ (obj['2']?.key ?? 0) ^ (obj['3']?.key ?? 0);
}

function groupArrayBy<T, U>(
  arr: Array<T>,
  getKey: (value: T) => string,
  mapValue: (val: T) => U
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

function mapObject<T, U>(obj: { [key: string]: T }, mapValue: (val: T, key: string) => U): { [key: string]: U } {
  return Object.entries(obj)
    .map(([key, value]) => [key, mapValue(value, key)] as const)
    .reduce<{ [key: string]: U }>((acc, [k, v]) => {
      acc[k] = v;
      return acc;
    }, {});
}
