import { TextEncoder } from 'util';
import { MerkleTree } from '../src/MerkleTree';
import { Timestamp } from '../src/Timestamp';
import { MurmurHash } from '../src/MurmurHash';

if (typeof TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}

test('Can insert into empty', () => {
  expect(() => MerkleTree.insert({}, new Timestamp(1602623792, 0, '1'))).not.toThrow();
});

test.skip('MerkleTree.insert', () => {
  let tree: MerkleTree = {};

  const ts1 = new Timestamp(1602623792, 0, '1');
  tree = MerkleTree.insert(tree, ts1);
  expect(MurmurHash(ts1.toString())).toBe(1753355675);
  expect(tree).toEqual(
    // prettier-ignore
    { '1': {'1': {'0': {'0': {'1': {'2': {'2': {'0': { '2': { '1': { hash: 1753355675 }, hash: 1753355675 }, hash: 1753355675 },hash: 1753355675,},hash: 1753355675,},hash: 1753355675,},hash: 1753355675,},hash: 1753355675,},hash: 1753355675,},hash: 1753355675,},hash: 1753355675,}
  );

  const ts2 = new Timestamp(1602623792, 1, '2');
  tree = MerkleTree.insert(tree, ts2);
  expect(tree).toEqual(
    // prettier-ignore
    { '1': { '1': { '0': { '0': { '1': { '2': { '2': { '0': { '2': { '1': { hash: -1454505632 }, hash: -1454505632 }, hash: -1454505632 }, hash: -1454505632, }, hash: -1454505632, }, hash: -1454505632, }, hash: -1454505632, }, hash: -1454505632, }, hash: -1454505632, }, hash: -1454505632, }, hash: -1454505632,}
  );
});

test('MerkleTree.diff same', () => {
  const tree1 = MerkleTree.insert({}, new Timestamp(1602623792, 0, '1'));
  const tree2 = MerkleTree.insert({}, new Timestamp(1602623792, 0, '1'));

  expect(MerkleTree.diff(tree1, tree2)).toBe(null);
});
