// Given a string and an optional seed as an int, returns a 32 bit hash (8 char base 16)
// using the x86 flavor of MurmurHash3, as an unsigned int.
export function MurmurHash(key: string, seed: number = 0): number {
  const remainder = key.length % 4;
  const bytes = key.length - remainder;

  let h1 = seed;

  let k1 = 0;

  const c1 = 0xcc9e2d51;
  const c2 = 0x1b873593;

  let i = 0;

  for (i = 0; i < bytes; i = i + 4) {
    k1 =
      (key.charCodeAt(i) & 0xff) |
      ((key.charCodeAt(i + 1) & 0xff) << 8) |
      ((key.charCodeAt(i + 2) & 0xff) << 16) |
      ((key.charCodeAt(i + 3) & 0xff) << 24);

    k1 = x86Multiply(k1, c1);
    k1 = x86Rotl(k1, 15);
    k1 = x86Multiply(k1, c2);

    h1 ^= k1;
    h1 = x86Rotl(h1, 13);
    h1 = x86Multiply(h1, 5) + 0xe6546b64;
  }

  k1 = 0;

  switch (remainder) {
    // @ts-expect-error allow no break
    case 3:
      k1 ^= (key.charCodeAt(i + 2) & 0xff) << 16;
    // @ts-expect-error allow no break
    case 2:
      k1 ^= (key.charCodeAt(i + 1) & 0xff) << 8;
    case 1:
      k1 ^= key.charCodeAt(i) & 0xff;
      k1 = x86Multiply(k1, c1);
      k1 = x86Rotl(k1, 15);
      k1 = x86Multiply(k1, c2);
      h1 ^= k1;
  }

  h1 ^= key.length;
  h1 = x86Fmix(h1);

  return h1 >>> 0;
}

// Given two 32bit ints, returns the two multiplied together as a 32bit int.
function x86Multiply(m: number, n: number): number {
  return (m & 0xffff) * n + ((((m >>> 16) * n) & 0xffff) << 16);
}

// Given a 32bit int and an int representing a number of bit positions,
// returns the 32bit int rotated left by that number of positions.
function x86Rotl(m: number, n: number): number {
  return (m << n) | (m >>> (32 - n));
}

// Given a block, returns murmurHash3's final x86 mix of that block.
function x86Fmix(h: number): number {
  h ^= h >>> 16;
  h = x86Multiply(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = x86Multiply(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h;
}
