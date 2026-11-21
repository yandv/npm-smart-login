import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig, saveConfig } from '../src/config-store.js';
import { resolvePaths, type Paths } from '../src/paths.js';
import { switchProfile } from '../src/profiles.js';

describe('switchProfile', () => {
  let home: string;
  let paths: Paths;

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'nsl-profiles-'));
    paths = resolvePaths(home);
  });

  afterEach(() => {
    fs.rmSync(home, { recursive: true, force: true });
  });

  it('creates an empty profile and points .npmrc at it', () => {
    const result = switchProfile(paths, 'work');

    expect(result).toEqual({ created: true });
    expect(fs.readFileSync(path.join(home, '.npmrc-work'), 'utf-8')).toBe('');
    expect(fs.readlinkSync(paths.npmrc)).toBe(path.join(home, '.npmrc-work'));
  });

  it('records the account as current with no expiry yet', () => {
    switchProfile(paths, 'work');

    expect(loadConfig(paths.config)).toEqual({
      accounts: { work: { expiresAt: '', npmrcPath: path.join(home, '.npmrc-work') } },
      current: 'work',
    });
  });

  it('keeps the credentials of an existing profile', () => {
    fs.writeFileSync(path.join(home, '.npmrc-work'), '//registry.npmjs.org/:_authToken=secret-work\n');

    const result = switchProfile(paths, 'work');

    expect(result).toEqual({ created: false });
    expect(fs.readFileSync(paths.npmrc, 'utf-8')).toBe('//registry.npmjs.org/:_authToken=secret-work\n');
  });

  it('moves a regular .npmrc to the default profile before linking', () => {
    fs.writeFileSync(paths.npmrc, 'registry=https://registry.npmjs.org/\n');

    switchProfile(paths, 'work');

    expect(fs.readFileSync(path.join(home, '.npmrc-default'), 'utf-8')).toBe('registry=https://registry.npmjs.org/\n');
    expect(fs.lstatSync(paths.npmrc).isSymbolicLink()).toBe(true);
  });

  it('swaps the symlink between profiles and keeps both files', () => {
    switchProfile(paths, 'work');
    fs.writeFileSync(path.join(home, '.npmrc-work'), 'work-credentials\n');

    switchProfile(paths, 'personal');
    const personalContent = fs.readFileSync(paths.npmrc, 'utf-8');
    switchProfile(paths, 'work');

    expect(personalContent).toBe('');
    expect(fs.readFileSync(paths.npmrc, 'utf-8')).toBe('work-credentials\n');
    expect(loadConfig(paths.config).current).toBe('work');
    expect(Object.keys(loadConfig(paths.config).accounts)).toEqual(['work', 'personal']);
  });

  it('keeps the expiry already stored for an account', () => {
    const workNpmrc = path.join(home, '.npmrc-work');
    saveConfig(paths.config, { accounts: { work: { expiresAt: '2026-06-08T12:00:00.000Z', npmrcPath: workNpmrc } }, current: null });

    switchProfile(paths, 'work');

    expect(loadConfig(paths.config).accounts['work']?.expiresAt).toBe('2026-06-08T12:00:00.000Z');
  });
});
