import { MerkleSearchTree } from '../src/MerkleSearchTree';
import dedent from 'ts-dedent';

test('Create MST', () => {
  expect(() => MerkleSearchTree.create()).not.toThrow();
  expect(MerkleSearchTree.create()).toEqual(null);
});

test('Find Root Layer', () => {
  expect(MerkleSearchTree.findRootLayer(null)).toBe(0);
  expect(
    MerkleSearchTree.findRootLayer({
      sub: ['1602623793-0000-0001'],
      key: 2034601380,
    })
  ).toBe(0);
  expect(
    MerkleSearchTree.findRootLayer({
      key: 72608459,
      sub: ['1602623794-0000-0020'],
    })
  ).toBe(1);
  expect(
    MerkleSearchTree.findRootLayer({
      key: 72608459,
      sub: [
        {
          key: 72608459,
          sub: ['1602623794-0000-0020'],
        },
      ],
    })
  ).toBe(2);
});

test('Build MST', () => {
  expect(MerkleSearchTree.build()).toBe(null);
  expect(MerkleSearchTree.build()).toBe(MerkleSearchTree.create());

  expect(MerkleSearchTree.build('1602623793-0000-0001')).toEqual({ key: 2034601380, sub: ['1602623793-0000-0001'] });

  expect(MerkleSearchTree.build('1602623793-0000-0001', '1602623794-0000-0020')).toEqual({
    key: 2098620271,
    sub: [{ key: 2034601380, sub: ['1602623793-0000-0001'] }, '1602623794-0000-0020'],
  });

  expect(MerkleSearchTree.build('1602623793-0000-0001', '1602623794-0000-0020')).toEqual(
    MerkleSearchTree.build('1602623794-0000-0020', '1602623793-0000-0001')
  );

  expect(
    MerkleSearchTree.build(
      '1602623793-0000-0001',
      '1602623794-0000-0020',
      '1602623794-0000-0005',
      '1602623794-0000-0006',
      '1602623794-0000-0007'
    )
  ).toEqual({
    key: 1728545697,
    sub: [
      {
        key: 1666476394,
        sub: ['1602623793-0000-0001', '1602623794-0000-0005', '1602623794-0000-0006', '1602623794-0000-0007'],
      },
      '1602623794-0000-0020',
    ],
  });

  expect(
    MerkleSearchTree.debug(
      MerkleSearchTree.build(
        '1602623794-0000-0003',
        '1602623794-0000-0020',
        '1602623794-0000-0178',
        '1602623795-0000-2358',
        '1602643477-0000-6934',
        '1602623795-0000-2418',
        '1602643477-0000-7031',
        '1602620886-0000-0283',
        '1602610233-0000-0114',
        '1006212175-0000-0000',
        '1099459327-0000-0000'
      )
    )
  ).toEqual(dedent`
    > 2875643e (7)
      > 00000010 (6)
        - 00000010 -> 1006212175-0000-0000
      - 00000002 -> 1099459327-0000-0000
      > 28756430 (6)
        - 00000099 -> 1602610233-0000-0114
        > 287564b7 (5)
          - 000002f4 -> 1602620886-0000-0283
          > 28756643 (4)
            > 287a6413 (3)
              > 2878f8cc (2)
                > 28baf1a9 (1)
                  > 2ce91b64 (0)
                    - d316e49c -> 1602623794-0000-0003
                  - 0453eacb -> 1602623794-0000-0020
                - 00c20963 -> 1602623794-0000-0178
              - 00029cd9 -> 1602623795-0000-2358
            - 0000ab37 -> 1602623795-0000-2418
            > 000fb019 (3)
              - 000fb019 -> 1602643477-0000-6934
            - 0000197e -> 1602643477-0000-7031
  `);
});

test('Insert level 0', () => {
  const mst = MerkleSearchTree.create();
  expect(MerkleSearchTree.insert(mst, '1602623793-0000-0001')).toEqual(MerkleSearchTree.build('1602623793-0000-0001'));
});

test('Insert level 1', () => {
  const mst = MerkleSearchTree.create();
  expect(MerkleSearchTree.insert(mst, '1602623794-0000-0020')).toEqual(MerkleSearchTree.build('1602623794-0000-0020'));
});

test('Insert two', () => {
  let mst = MerkleSearchTree.create();
  mst = MerkleSearchTree.insert(mst, '1602623793-0000-0001');
  expect(mst).toEqual({ sub: ['1602623793-0000-0001'], key: 2034601380 });
  mst = MerkleSearchTree.insert(mst, '1602623794-0000-0020');
  expect(mst).toEqual(MerkleSearchTree.build('1602623793-0000-0001', '1602623794-0000-0020'));
});

test('Insert two inverse order', () => {
  let mst = MerkleSearchTree.create();
  mst = MerkleSearchTree.insert(mst, '1602623794-0000-0020');
  mst = MerkleSearchTree.insert(mst, '1602623793-0000-0001');
  expect(mst).toEqual(MerkleSearchTree.build('1602623793-0000-0001', '1602623794-0000-0020'));
});

test('Insert two deep', () => {
  let mst = MerkleSearchTree.create();
  mst = MerkleSearchTree.insert(mst, '1602623795-0000-2358');
  mst = MerkleSearchTree.insert(mst, '1602643477-0000-6934');
  expect(mst).toEqual(MerkleSearchTree.build('1602623795-0000-2358', '1602643477-0000-6934'));
});

test('Insert two deep different level', () => {
  let mst = MerkleSearchTree.create();
  mst = MerkleSearchTree.insert(mst, '1602623795-0000-2358');
  mst = MerkleSearchTree.insert(mst, '1602610233-0000-0114');
  expect(mst).toEqual(MerkleSearchTree.build('1602623795-0000-2358', '1602610233-0000-0114'));
});

test('Insert two deep different level reverse', () => {
  let mst = MerkleSearchTree.create();
  mst = MerkleSearchTree.insert(mst, '1602610233-0000-0114');
  mst = MerkleSearchTree.insert(mst, '1602623795-0000-2358');
  expect(mst).toEqual(MerkleSearchTree.build('1602623795-0000-2358', '1602610233-0000-0114'));
});

test('Insert two siblings', () => {
  let mst = MerkleSearchTree.create();
  mst = MerkleSearchTree.insert(mst, '1602623793-0000-0003');
  mst = MerkleSearchTree.insert(mst, '1602623793-0000-0004');
  expect(mst).toEqual(MerkleSearchTree.build('1602623793-0000-0003', '1602623793-0000-0004'));
});

test('Insert two siblings inverse', () => {
  let mst = MerkleSearchTree.create();
  mst = MerkleSearchTree.insert(mst, '1602623793-0000-0004');
  mst = MerkleSearchTree.insert(mst, '1602623793-0000-0003');
  expect(mst).toEqual(MerkleSearchTree.build('1602623793-0000-0003', '1602623793-0000-0004'));
});

test('Insert three siblings', () => {
  let mst = MerkleSearchTree.create();
  mst = MerkleSearchTree.insert(mst, '1602623793-0000-0003');
  mst = MerkleSearchTree.insert(mst, '1602623793-0000-0004');
  mst = MerkleSearchTree.insert(mst, '1602623793-0000-0005');
  expect(mst).toEqual(MerkleSearchTree.build('1602623793-0000-0003', '1602623793-0000-0004', '1602623793-0000-0005'));
});
