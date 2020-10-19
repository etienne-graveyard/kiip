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
  expect(MurmurHash('1602623795-0000-2359')).toBe(3767966136);

  expect(MurmurHash('1602510027-0000-8810')).toBe(0);

  expect(MurmurHash('', 82412784)).toBe(2896484089);
});

test('Combine', () => {
  expect(
    MurmurHash('1602623793-0000-0001') ^
      MurmurHash('1602623794-0000-0005') ^
      MurmurHash('1602623794-0000-0006') ^
      MurmurHash('1602623794-0000-0007')
  ).toBe(1666476394);

  expect(1666476394 ^ MurmurHash('1602623794-0000-0020')).toBe(1728545697);
});

test('MurmurHashHex', () => {
  expect(MurmurHashHex('')).toBe('00000000');

  expect(MurmurHashHex('1602623794-0000-0003')).toBe('d316e49c');
  expect(MurmurHashHex('1602623795-0000-2359')).toBe('e09699b8');

  expect(MurmurHashHex('1602623794-0000-0020')).toBe('0453eacb');

  expect(MurmurHashHex('1602623794-0000-0178')).toBe('00c20963');

  expect(MurmurHashHex('1602623795-0000-2358')).toBe('00029cd9');
  expect(MurmurHashHex('1602643477-0000-6934')).toBe('000fb019');

  expect(MurmurHashHex('1602623795-0000-2418')).toBe('0000ab37');
  expect(MurmurHashHex('1602643477-0000-7031')).toBe('0000197e');

  expect(MurmurHashHex('1602620886-0000-0283')).toBe('000002f4');

  expect(MurmurHashHex('1602610233-0000-0114')).toBe('00000099');
  expect(MurmurHashHex('1006212175-0000-0000')).toBe('00000010');

  expect(MurmurHashHex('1099459327-0000-0000')).toBe('00000002');

  expect(MurmurHashHex('1602510027-0000-8810')).toBe('00000000');
});

test('MurmurHashHex simple', () => {
  const layer1 = ['2', '3', '1h', '1k', '1q', '3f', '3x', '3z', '4y', '53', '56'];
  const layer2 = ['jm', 'l9', 'm5', 'yi', '13a', '15o', '1b1', '1bo', '1go', '1jf', '1rf'];
  const layer3 = ['6v', 'ol', '2jg', '3m2', '43f', '4jn', '5hw', '7a6', '8ch', 'anx', 'e5c'];
  const layer4 = ['aqk', '19e7', '2gdt', '3b4i', '4qdh', '5bce', '5d46', '720q', '72tu', '7642', 'a7ex'];
  const layer5 = ['knl9', 'nzzw', 'pe26', 'rrod', 'vatn', '1dvw6', '1fu1n', '1k9t3', '1vwvt', '32spl', '3o1uk'];
  const layer6 = ['9wvct', 'pd7uh', '1hivie', '1l0hfw', '21yrqy', '2mvkfw', '2xpsx5', '2yhcj5', '38z6j6', '3qlflx'];

  layer1.forEach((str) => {
    const hash = MurmurHashHex(str);
    expect(hash.startsWith('0')).toBe(true);
    expect(hash[1]).not.toBe('0');
  });

  layer2.forEach((str) => {
    const hash = MurmurHashHex(str);
    expect(hash.startsWith('00')).toBe(true);
    expect(hash[2]).not.toBe('0');
  });

  layer3.forEach((str) => {
    const hash = MurmurHashHex(str);
    expect(hash.startsWith('000')).toBe(true);
    expect(hash[3]).not.toBe('0');
  });

  layer4.forEach((str) => {
    const hash = MurmurHashHex(str);
    expect(hash.startsWith('0000')).toBe(true);
    expect(hash[4]).not.toBe('0');
  });

  layer5.forEach((str) => {
    const hash = MurmurHashHex(str);
    expect(hash.startsWith('00000')).toBe(true);
    expect(hash[5]).not.toBe('0');
  });

  layer6.forEach((str) => {
    const hash = MurmurHashHex(str);
    expect(hash.startsWith('000000')).toBe(true);
    expect(hash[6]).not.toBe('0');
  });
});
