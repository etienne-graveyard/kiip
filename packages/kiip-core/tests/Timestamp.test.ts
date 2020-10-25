import { Timestamp } from '../src/Timestamp';

const TS = Timestamp.withConfig();

test('create Timestamp', () => {
  expect(() => TS.create({ time: 0, counter: 0, id: 'AZERTYUI' })).not.toThrow();
  expect(TS.create({ time: 0, counter: 0, id: 'AZERTYUI' }).toString()).toBe('0000000000AZERTYUI');
});

// test('parse Timestamp', () => {
//   expect(() => HLC.parse('0000000000AZERTYUI')).not.toThrow();
//   expect(HLC.parse('0000000000AZERTYUI')).toEqual({ counter: 0, id: 'AZERTYUI', time: 0 });
// });

// test('parse throw on invalid', () => {
//   expect(() => HLC.parse('0000000000AZERTYU')).toThrow(HybridLogicalClock.TimestampsError);
//   expect(() => HLC.parse('0000000000AZERTYU')).toThrow(HybridLogicalClock.InvalidTimestampsLengthError);
//   expect(() => HLC.parse('----------AZERTYUI')).toThrow(HybridLogicalClock.TimestampsNumberParseError);
// });

// test('serialize ', () => {
//   expect(HLC.serialize(1603234456600 / 1000, 34, '12345678')).toBe('1fouqko01212345678');
//   expect(HLC.serialize(1603234456600 / 1000, 2345, '--------')).toBe('1fouqko299--------');
// });

// test('throw on overflow ', () => {
//   expect(() => HLC.serialize(0, 32767, '--------')).not.toThrow();
//   expect(() => HLC.serialize(0, 32768, '--------')).toThrow(HybridLogicalClock.TimestampsCounterOverflowError);

//   expect(() => HLC.serialize(34359738367, 0, '--------')).not.toThrow();
//   expect(() => HLC.serialize(34359738368, 0, '--------')).toThrow(HybridLogicalClock.TimestampsTimeOverflowError);
// });

// test('throw on invalid id length ', () => {
//   expect(() => HLC.serialize(0, 0, '--------')).not.toThrow();
//   expect(() => HLC.serialize(0, 0, '---------')).toThrow(HybridLogicalClock.InvalidTimestampsParamError);
//   expect(() => HLC.serialize(0, 0, '-------')).toThrow(HybridLogicalClock.InvalidTimestampsParamError);
// });
