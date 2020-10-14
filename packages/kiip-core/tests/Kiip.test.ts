import { Kiip, KiipMemoryDb } from '../src';
import { RandomUtils } from './RandomUtils';

jest.mock('../src/utils');

test('Init kiip', () => {
  expect(() => Kiip<{}, {}>(KiipMemoryDb(), { getInitialMetadata: () => ({}) })).not.toThrow();
});

type Meta = { name: string };
type Schema = {
  users: {
    firstName: string;
    lastName: string;
    age: number;
  };
};

test('Create document', async () => {
  RandomUtils.mockNextId('91pxG4cSwX8WbH3w');
  RandomUtils.mockNextId('3oymZMOnQdGlo7or');
  const client1 = Kiip<Schema, Meta>(KiipMemoryDb(), { getInitialMetadata: () => ({ name: 'Test' }) });
  const docs = await client1.getDocuments();
  expect(docs).toEqual([]);
  const doc = await client1.createDocument();
  expect(doc).toEqual({ data: {}, id: '91pxG4cSwX8WbH3w', meta: { name: 'Test' }, nodeId: '3oymZMOnQdGlo7or' });
  expect(doc.nodeId).toBeDefined();
  const store = await client1.getDocumentStore('91pxG4cSwX8WbH3w');
  RandomUtils.mockNextId('V9taZM34Twu3NeNN');
  await store.insert('users', { firstName: 'Etienne', lastName: 'Dldc', age: 25 });
  expect(store.getState().data).toEqual({
    users: { V9taZM34Twu3NeNN: { age: 25, firstName: 'Etienne', lastName: 'Dldc' } },
  });
});
