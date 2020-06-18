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
