import { MerkleSearchTree } from '../src/MerkleSearchTree';

test('Create MST', () => {
  expect(() => MerkleSearchTree.create()).not.toThrow();
  expect(MerkleSearchTree.create()).toEqual(null);
});

test('FindMaxLevel', () => {
  expect(MerkleSearchTree.findMaxLevel(null)).toBe(0);
  expect(
    MerkleSearchTree.findMaxLevel({
      key: '12345',
      sub: ['YOLO'],
      lvl: 0,
    })
  ).toBe(0);
  expect(
    MerkleSearchTree.findMaxLevel({
      key: '12345',
      sub: ['YOLO', { key: '2345', sub: ['OOPS'], lvl: 0 }],
      lvl: 1,
    })
  ).toBe(1);
});

test('Insert level 0', () => {
  const mst = MerkleSearchTree.create();
  expect(MerkleSearchTree.insert(mst, '1602623793-0000-0001')).toEqual({
    sub: ['1602623793-0000-0001'],
    key: '79458da4',
    lvl: 0,
  });
});

test('Insert level 1', () => {
  const mst = MerkleSearchTree.create();
  expect(MerkleSearchTree.insert(mst, '1602623794-0000-0020')).toEqual({
    key: '0453eacb',
    lvl: 1,
    sub: ['1602623794-0000-0020'],
  });
});

test('Insert two', () => {
  let mst = MerkleSearchTree.create();
  mst = MerkleSearchTree.insert(mst, '1602623793-0000-0001');
  expect(mst).toEqual({ sub: ['1602623793-0000-0001'], key: '79458da4', lvl: 0 });
  mst = MerkleSearchTree.insert(mst, '1602623794-0000-0020');
  expect(mst).toEqual({
    key: 'c938e51c',
    lvl: 2,
    sub: [
      { key: '94c1861a', lvl: 1, sub: [{ key: '79458da4', lvl: 0, sub: ['1602623793-0000-0001'] }] },
      { key: '0453eacb', lvl: 1, sub: ['1602623794-0000-0020'] },
    ],
  });
});
