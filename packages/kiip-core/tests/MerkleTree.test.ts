import { MerkleTree } from '../src/MerkleTree';
import { Timestamp } from '../src/Timestamp';

const MT = new MerkleTree({ Timestamp: Timestamp.withConfig() });

test('build tree', () => {
  expect(MT.empty()).toEqual(null);
});

// describe('Build', () => {
//   test('build tree', () => {
//     expect(MerkleTree.build('1fp29js0008lur7l9t')).toEqual({
//       base: '1133210102121330',
//       items: ['0008lur7l9t'],
//       key: 1658195516,
//     });
//   });

//   test('build tree', () => {
//     expect(
//       MerkleTree.build(
//         '1fp29js0008lur7l9t',
//         '1fp29k10008lur7l9t',
//         '1fp29k20008lur7l9t',
//         '1fp29k20018lur7l9t',
//         '1fp29k20028lur7l9t',
//         '1fp29k20038lur7l9t',
//         '1fp29k20048lur7l9t',
//         '1fp29k30008lur7l9t'
//       )
//     ).toEqual({
//       '1': {
//         key: 1658195516,
//         '3': { '3': { '0': { items: ['0008lur7l9t'], key: 1658195516 }, key: 1658195516 }, key: 1658195516 },
//       },
//       '2': {
//         '0': {
//           '0': {
//             '1': { items: ['0008lur7l9t'], key: 1658195516 },
//             '2': {
//               items: ['0008lur7l9t', '0018lur7l9t', '0028lur7l9t', '0038lur7l9t', '0048lur7l9t'],
//               key: -1367903248,
//             },
//             '3': { items: ['0008lur7l9t'], key: 1658195516 },
//             key: -1367903248,
//           },
//           key: -1367903248,
//         },
//         key: -1367903248,
//       },
//       base: '113321010212',
//       key: -861831732,
//     });
//   });
// });

// describe('Find node', () => {
//   test('Find node', () => {
//     const mt = MerkleTree.build(
//       '1fp29js0008lur7l9t',
//       '1fp29k10008lur7l9t',
//       '1fp29k20008lur7l9t',
//       '1fp29k20018lur7l9t',
//       '1fp29k20028lur7l9t',
//       '1fp29k20038lur7l9t',
//       '1fp29k20048lur7l9t',
//       '1fp29k30008lur7l9t'
//     );
//     expect(MerkleTree.findNode(mt, '113321010212')).toEqual(mt);
//     expect(MerkleTree.findNode(mt, '1133210102121')).toEqual({
//       key: 1658195516,
//       '3': { '3': { '0': { items: ['0008lur7l9t'], key: 1658195516 }, key: 1658195516 }, key: 1658195516 },
//     });
//     expect(MerkleTree.findNode(mt, '11332101021213')).toEqual({
//       '3': { '0': { items: ['0008lur7l9t'], key: 1658195516 }, key: 1658195516 },
//       key: 1658195516,
//     });
//     expect(MerkleTree.findNode(mt, '11332101021212')).toEqual(null);
//   });
// });

// describe('Insert', () => {
//   test('Insert into null', () => {
//     expect(MerkleTree.insert(null, '1fp29k30008lur7l9t')).toEqual({
//       base: '1133210102122003',
//       items: ['0008lur7l9t'],
//       key: 1658195516,
//     });
//   });

//   test('Insert', () => {
//     const mt = MerkleTree.build('1fp29k30008lur7l9t');
//     expect(MerkleTree.insert(mt, '1fp29k30008lur7l9t')).toEqual({
//       base: '1133210102122003',
//       items: ['0008lur7l9t'],
//       key: 1658195516,
//     });
//   });
// });
