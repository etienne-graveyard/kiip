import { MurmurHash, MurmurHashHex } from '../src/MurmurHash';
import { TextEncoder } from 'util';

if (typeof TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}

test('MurmurHash', () => {
  expect(MurmurHash('I will not buy this record, it is scratched.')).toBe(2832214938);
  expect(MurmurHash('My hovercraft is full of eels.', 0)).toBe(2953494853);
  expect(MurmurHash('My hovercraft is full of eels.', 25)).toBe(2520298415);
  expect(MurmurHash('My hovercraft is full of eels.', 128)).toBe(2204470254);

  expect(MurmurHash('I will not buy this record, it is scratched.')).toBe(2832214938);
  expect(MurmurHash('')).toBe(0);
  expect(MurmurHash('0')).toBe(3530670207);
  expect(MurmurHash('01')).toBe(1642882560);
  expect(MurmurHash('012')).toBe(3966566284);
  expect(MurmurHash('0123')).toBe(3558446240);
  expect(MurmurHash('01234')).toBe(433070448);
  expect(MurmurHash('', 1)).toBe(1364076727);

  expect(MurmurHash('1970-01-19T13:10:23.792Z-0000-1')).toBe(1753355675);
  expect(MurmurHash('1970-01-19T13:10:23.792Z-0001-1')).toBe(1236498653);
  expect(MurmurHash('1970-01-19T13:10:23.793Z-0001-1')).toBe(2807268460);
  expect(MurmurHash('1970-01-19T13:10:23.793Z-0001-')).toBe(557780598);
  expect(MurmurHash('1970-01-19T13:10:23.793Z-0001')).toBe(3170371958);
  expect(MurmurHash('', 82412784)).toBe(2896484089);
});

test('MurmurHashHex', () => {
  expect(MurmurHashHex('')).toBe('00000000');

  expect(MurmurHashHex('1602623794-0000-0020')).toBe('0453eacb');

  expect(MurmurHashHex('1602623794-0000-0178')).toBe('00c20963');

  expect(MurmurHashHex('1602623795-0000-2358')).toBe('00029cd9');
  expect(MurmurHashHex('1602643477-0000-6934')).toBe('000fb019');

  expect(MurmurHashHex('1602623795-0000-2418')).toBe('0000ab37');
  expect(MurmurHashHex('1602643477-0000-7031')).toBe('0000197e');

  // for (let i = 0; i < 9999; i++) {
  //   if (MurmurHashHex('1602643477-0000-' + ('0000' + i).slice(-4)).startsWith('000')) {
  //     console.log(i);
  //   }
  // }
});
