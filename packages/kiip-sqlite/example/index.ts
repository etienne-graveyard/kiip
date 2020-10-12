import { Kiip } from '@kiip/core';
import { KiipSQLite } from '../src';
import * as path from 'path';

const database = KiipSQLite(path.resolve(__dirname, '..', './example/db.sql'));

type Schema = {
  todos: {
    name: string;
    done: boolean;
  };
};

const a: { [key: string]: { [key: string]: boolean } } = { foo: { bar: true } };

const kiip = Kiip<Schema, { name: string }>(database, {
  getInitialMetadata: () => ({ name: 'New Document' }),
});

(async () => {
  const doc = await kiip.createDocument();

  console.log(doc.getState());
  await doc.insert('todos', { name: 'Learn React', done: true });
})();
