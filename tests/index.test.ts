import { Kiip } from '../src';
import { KiipMemoryDb } from './utils/MemoryDb';

test('Init kiip', () => {
  expect(() => Kiip(KiipMemoryDb(), { getInitialMetadata: () => {} })).not.toThrow();
});
