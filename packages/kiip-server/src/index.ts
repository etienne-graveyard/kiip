import { Core } from './Core';

export function command(): void {
  Core().then((core) => {
    core.start();
  });
}
