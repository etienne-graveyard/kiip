import { MurmurHash } from './MurmurHash';
import { Timestamp, MutableTimestamp } from './Timestamp';
import { TextEncoder } from 'util';

if (typeof TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}

test('Timestamp', () => {
  expect(() => new Timestamp(1602623792, 0, '1')).not.toThrow();
});

test('Timestamp to string', () => {
  const ts = new Timestamp(1602623792, 0, '1');
  expect(ts.toString()).toBe('1970-01-19T13:10:23.792Z-0000-1');
});

test('Compare Timestamps', () => {
  const ts1 = new Timestamp(1602623792, 0, '1');
  const ts2 = new Timestamp(1602623793, 0, '1');
  expect(ts1 < ts2).toBe(true);
});

test('Timestamps has', () => {
  const ts = new Timestamp(1602623792, 0, '1');
  expect(ts.hash).toBe(1753355675);
  expect(ts.hash).toBe(MurmurHash('1970-01-19T13:10:23.792Z-0000-1'));
});

test('Timestamps parse', () => {
  expect(Timestamp.parse('1970-01-19T13:10:23.792Z-0000-1').toString()).toBe('1970-01-19T13:10:23.792Z-0000-1');
  expect(() => Timestamp.parse('')).toThrow();
  expect(() => Timestamp.parse('1970-01-19T13:10:23.792Z-gggg-1')).toThrow();
});

test('MutableTimestamp', () => {
  const mts = new MutableTimestamp(1602623792, 0, '1');
  expect(mts.toString()).toBe('1970-01-19T13:10:23.792Z-0000-1');
  mts.setMillis(1602623793);
  expect(mts.toString()).toBe('1970-01-19T13:10:23.793Z-0000-1');
  mts.setCounter(10);
  expect(mts.toString()).toBe('1970-01-19T13:10:23.793Z-000A-1');
});

test('MutableTimestamp.from', () => {
  expect(MutableTimestamp.from(new Timestamp(1602623792, 0, '1')).toString()).toBe('1970-01-19T13:10:23.792Z-0000-1');
});
