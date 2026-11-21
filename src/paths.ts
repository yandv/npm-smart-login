import path from 'node:path';

export interface Paths {
  config: string;
  npmrc: string;
}

export function resolvePaths(home: string): Paths {
  return {
    config: path.join(home, '.npm-smart-login.json'),
    npmrc: path.join(home, '.npmrc'),
  };
}

export function profilePath(paths: Paths, account: string): string {
  return `${paths.npmrc}-${account}`;
}
