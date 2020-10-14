import { DateUtil } from './DateUtils';
import { Clock } from '../src/Clock';
import { MerkleTree } from '../src/MerkleTree';
import { Timestamp } from '../src/Timestamp';

test('Create Clock', () => {
  DateUtil.setNow(1602632453863);

  expect(() => new Clock('12345678azertyui')).not.toThrow();
  const clock = new Clock('12345678azertyui');
  expect(clock.merkle).toEqual({});
  expect(clock.node).toBe('12345678azertyui');
  expect(clock.send().toString()).toBe('2020-10-13T23:40:53.863Z-0000-12345678azertyui');
  expect(clock.send().toString()).toBe('2020-10-13T23:40:53.863Z-0001-12345678azertyui');
  Array.from({ length: 13 }).forEach(() => {
    clock.send();
  });
  expect(clock.send().toString()).toBe('2020-10-13T23:40:53.863Z-000F-12345678azertyui');
});

test('Clock send Max Drift', () => {
  DateUtil.setNow(1602632453863);
  const clock = new Clock('12345678azertyui');
  expect(clock.send().toString()).toBe('2020-10-13T23:40:53.863Z-0000-12345678azertyui');
  DateUtil.tick(-60000);
  expect(clock.send().toString()).toBe('2020-10-13T23:40:53.863Z-0001-12345678azertyui');
  DateUtil.tick(-1);
  expect(() => clock.send()).toThrow(Clock.ClockDriftError);
}, 6000);

test('Clock send Overflow', () => {
  DateUtil.setNow(1602632453863);

  const clock = new Clock('12345678azertyui');
  Array.from({ length: 65536 }).forEach(() => {
    clock.send();
  });
  expect(() => clock.send()).toThrow(Clock.OverflowError);
}, 6000);

test('Clock recv Max Drift', () => {
  DateUtil.setNow(1602632453863);
  const clock = new Clock('12345678azertyui');
  clock.recv(new Timestamp(1602632453863, 0, 'azertyuiazererty'));
  DateUtil.tick(-60000);
  clock.recv(new Timestamp(1602632453863, 0, 'azertyuiazererty'));
  DateUtil.tick(-1);
  expect(() => clock.recv(new Timestamp(1602632453863, 0, 'azertyuiazererty'))).toThrow(Clock.ClockDriftError);
}, 6000);

test('Clock recv Overflow', () => {
  DateUtil.setNow(1602632453863);

  const clock = new Clock('12345678azertyui');
  Array.from({ length: 65535 }).forEach(() => {
    clock.recv(new Timestamp(1602632453863, 0, 'azertyuiazererty'));
  });
  expect(() => clock.recv(new Timestamp(1602632453863, 0, 'azertyuiazererty'))).toThrow(Clock.OverflowError);
}, 10000);

test('Clock recv self', () => {
  DateUtil.setNow(1602632453863);
  const clock = new Clock('0000000000000001');
  expect(() => clock.recv(new Timestamp(1602632453863, 0, '0000000000000001'))).toThrow(Clock.DuplicateNodeError);
}, 10000);

test('Clock recv', () => {
  DateUtil.setNow(1602632453863);
  const clock1 = new Clock('0000000000000001');
  const clock2 = new Clock('0000000000000002');
  const ts1 = clock1.send();
  expect(ts1.toString()).toBe('2020-10-13T23:40:53.863Z-0000-0000000000000001');
  DateUtil.tick(50);
  clock2.recv(ts1);
  expect(MerkleTree.diff(clock1.merkle, clock2.merkle)).toBe(null);
  const ts2 = clock2.send();
  expect(ts2.toString()).toBe('2020-10-13T23:40:53.913Z-0001-0000000000000002');
});

test('Clock sync', () => {
  DateUtil.setNow(1600000000000);
  const clock1 = new Clock('0000000000000001');
  const clock2 = new Clock('0000000000000002');
  const ts1 = clock1.send();
  expect(ts1.toString()).toBe('2020-09-13T12:26:40.000Z-0000-0000000000000001');
  const ts2 = clock2.send();
  expect(ts2.toString()).toBe('2020-09-13T12:26:40.000Z-0000-0000000000000002');
  clock1.recv(ts2);
  clock2.recv(ts1);
  expect(MerkleTree.diff(clock1.merkle, clock2.merkle)).toBe(null);
});

test('Clock sync multi', () => {
  DateUtil.setNow(1600000000000);
  const clock1 = new Clock('0000000000000001');
  const clock2 = new Clock('0000000000000002');
  const ts1 = clock1.send();
  expect(ts1.toString()).toBe('2020-09-13T12:26:40.000Z-0000-0000000000000001');
  DateUtil.tick(30);
  const ts2 = clock1.send();
  expect(ts2.toString()).toBe('2020-09-13T12:26:40.030Z-0000-0000000000000001');
  DateUtil.tick(50);
  const ts3 = clock1.send();
  expect(ts3.toString()).toBe('2020-09-13T12:26:40.080Z-0000-0000000000000001');
  const ts4 = clock1.send();
  expect(ts4.toString()).toBe('2020-09-13T12:26:40.080Z-0001-0000000000000001');
  DateUtil.tick(1);
  const ts5 = clock1.send();
  expect(ts5.toString()).toBe('2020-09-13T12:26:40.081Z-0000-0000000000000001');
  DateUtil.tick(1000);
  const ts6 = clock1.send();
  expect(ts6.toString()).toBe('2020-09-13T12:26:41.081Z-0000-0000000000000001');
  DateUtil.tick(60000);
  const ts7 = clock1.send();
  expect(ts7.toString()).toBe('2020-09-13T12:27:41.081Z-0000-0000000000000001');

  expect(MerkleTree.diff(clock1.merkle, clock2.merkle)).toBe(1599999960000);
  clock2.recv(ts1);
  clock2.recv(ts2);
  clock2.recv(ts3);
  expect(MerkleTree.diff(clock1.merkle, clock2.merkle)).toBe(1599999960000);
  clock2.recv(ts4);
  clock2.recv(ts5);
  clock2.recv(ts6);
  expect(MerkleTree.diff(clock1.merkle, clock2.merkle)).toBe(1600000020000);
  clock2.recv(ts7);
  expect(MerkleTree.diff(clock1.merkle, clock2.merkle)).toBe(null);
});
