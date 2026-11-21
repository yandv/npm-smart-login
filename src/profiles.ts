import fs from 'node:fs';
import { loadConfig, saveConfig } from './config-store.js';
import { profilePath, type Paths } from './paths.js';

export interface SwitchResult {
  created: boolean;
}

export function switchProfile(paths: Paths, account: string): SwitchResult {
  const config = loadConfig(paths.config);
  const targetPath = profilePath(paths, account);

  const created = !fs.existsSync(targetPath);
  if (created) fs.writeFileSync(targetPath, '');

  // A real ~/.npmrc is kept as the "default" profile before it gets replaced by the symlink.
  if (fs.existsSync(paths.npmrc) && !fs.lstatSync(paths.npmrc).isSymbolicLink()) {
    fs.renameSync(paths.npmrc, profilePath(paths, 'default'));
  }
  if (fs.existsSync(paths.npmrc)) fs.unlinkSync(paths.npmrc);

  fs.symlinkSync(targetPath, paths.npmrc);
  config.current = account;
  if (!config.accounts[account]) {
    config.accounts[account] = { expiresAt: '', npmrcPath: targetPath };
  }
  saveConfig(paths.config, config);

  return { created };
}
