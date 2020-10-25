import { HybridLogicalClock, HybridLogicalClockConfig } from '../src/HybridLogicalClock';
import { Timestamp } from '../src/Timestamp';

const fakeNow = jest.fn().mockImplementation(() => {
  throw new Error('Missing mocked now');
});

const TS = Timestamp.withConfig();

const config: HybridLogicalClockConfig = { now: fakeNow, Timestamp: TS };

describe('HybridLogicalClock', () => {
  test('Create HybridLogicalClock', () => {
    fakeNow.mockReturnValueOnce(1603265000);
    expect(() => HybridLogicalClock.create('12345678', config)).not.toThrow();
  });

  test('send', () => {
    fakeNow.mockReturnValueOnce(1603265000);
    const hlc = HybridLogicalClock.create('12345678', config);
    fakeNow.mockReturnValueOnce(1603265000);
    expect(hlc.send().toString()).toBe('1fovof800112345678');
    fakeNow.mockReturnValueOnce(1603265000);
    expect(hlc.send().toObject()).toEqual({ counter: 2, id: '12345678', time: 1603265000 });

    // move time
    // fakeNow.mockReturnValueOnce(1603265001);
    // hlc = HLC.next(hlc);
    // const ts2 = HLC.serialize(hlc);
    // expect(ts < ts2).toBe(true);
    // expect(ts2).toBe('1fovof900012345678');
    // expect(HLC.parse(ts2)).toEqual({ counter: 0, id: '12345678', time: 1603265001 });
    // fakeNow.mockReturnValueOnce(1603265001);
    // hlc = HLC.next(hlc);
    // expect(hlc).toEqual({ counter: 1, id: '12345678', time: 1603265001 });
  });
});

// describe('Basic timestamp', () => {
//   const HLC = HybridLogicalClock.create({ now: fakeNow });

//   test('create Timestamp', () => {
//     expect(() => HLC.serialize(0, 0, 'AZERTYUI')).not.toThrow();
//     expect(HLC.serialize(0, 0, 'AZERTYUI')).toBe('0000000000AZERTYUI');
//   });

//   test('parse Timestamp', () => {
//     expect(() => HLC.parse('0000000000AZERTYUI')).not.toThrow();
//     expect(HLC.parse('0000000000AZERTYUI')).toEqual({ counter: 0, id: 'AZERTYUI', time: 0 });
//   });

//   test('parse throw on invalid', () => {
//     expect(() => HLC.parse('0000000000AZERTYU')).toThrow(HybridLogicalClock.TimestampsError);
//     expect(() => HLC.parse('0000000000AZERTYU')).toThrow(HybridLogicalClock.InvalidTimestampsLengthError);
//     expect(() => HLC.parse('----------AZERTYUI')).toThrow(HybridLogicalClock.TimestampsNumberParseError);
//   });

//   test('serialize ', () => {
//     expect(HLC.serialize(1603234456600 / 1000, 34, '12345678')).toBe('1fouqko01212345678');
//     expect(HLC.serialize(1603234456600 / 1000, 2345, '--------')).toBe('1fouqko299--------');
//   });

//   test('throw on overflow ', () => {
//     expect(() => HLC.serialize(0, 32767, '--------')).not.toThrow();
//     expect(() => HLC.serialize(0, 32768, '--------')).toThrow(HybridLogicalClock.TimestampsCounterOverflowError);

//     expect(() => HLC.serialize(34359738367, 0, '--------')).not.toThrow();
//     expect(() => HLC.serialize(34359738368, 0, '--------')).toThrow(HybridLogicalClock.TimestampsTimeOverflowError);
//   });

//   test('throw on invalid id length ', () => {
//     expect(() => HLC.serialize(0, 0, '--------')).not.toThrow();
//     expect(() => HLC.serialize(0, 0, '---------')).toThrow(HybridLogicalClock.InvalidTimestampsParamError);
//     expect(() => HLC.serialize(0, 0, '-------')).toThrow(HybridLogicalClock.InvalidTimestampsParamError);
//   });
// });
