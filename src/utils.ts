import { customAlphabet } from 'nanoid';

const DONE_TOKEN = Symbol('DONE_TOKEN');
export type DONE_TOKEN = typeof DONE_TOKEN;

export function createKiipPromise<T>(exec: (resolved: (value: T) => DONE_TOKEN) => DONE_TOKEN): Promise<T> {
  return new Promise((resolve, reject) => {
    return exec(val => {
      resolve(val);
      return DONE_TOKEN;
    });
  });
}

export function kiipCallbackFromAsync<T>(exec: () => Promise<T>, onResolve: (val: T) => DONE_TOKEN): DONE_TOKEN {
  exec().then(val => {
    onResolve(val);
  });
  return DONE_TOKEN;
}

export function createKiipCallbackSync<T>(exec: () => T, onResolve: (val: T) => DONE_TOKEN): DONE_TOKEN {
  const val = exec();
  onResolve(val);
  return DONE_TOKEN;
}

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';

export const createId = customAlphabet(ALPHABET, 22);

export const createShortId = customAlphabet(ALPHABET, 16);
