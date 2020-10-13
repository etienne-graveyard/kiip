import { DateUtil } from '../tests/DateUtils';
import { Clock } from './Clock';

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
  DateUtil.tick(-30000);
  expect(() => clock.send()).not.toThrow();
  // reach max drift, throw error
  DateUtil.tick(-31000);
  expect(() => clock.send()).toThrow(Clock.ClockDriftError);
});

test('Clock Overflow', () => {
  DateUtil.setNow(1602632453863);

  const clock = new Clock('12345678azertyui');
  Array.from({ length: 65536 }).forEach(() => {
    clock.send();
  });
  expect(() => clock.send()).toThrow(Clock.OverflowError);
});
