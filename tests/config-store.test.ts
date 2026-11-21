import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fc, test } from '@fast-check/vitest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadConfig, saveConfig, type Config } from '../src/config-store.js';

describe('config store', () => {
  let home: string;

  beforeAll(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'nsl-config-'));
  });

  afterAll(() => {
    fs.rmSync(home, { recursive: true, force: true });
  });

  it('starts empty when no config file exists', () => {
    expect(loadConfig(path.join(home, 'missing.json'))).toEqual({ accounts: {}, current: null });
  });

  it('writes the config as indented JSON', () => {
    const configPath = path.join(home, 'indented.json');

    saveConfig(configPath, { accounts: { work: { expiresAt: '2026-06-08T12:00:00.000Z', npmrcPath: '/h/.npmrc-work' } }, current: 'work' });

    expect(fs.readFileSync(configPath, 'utf-8')).toBe(
      '{\n  "accounts": {\n    "work": {\n      "expiresAt": "2026-06-08T12:00:00.000Z",\n      "npmrcPath": "/h/.npmrc-work"\n    }\n  },\n  "current": "work"\n}',
    );
  });

  const configArbitrary: fc.Arbitrary<Config> = fc.record({
    accounts: fc.dictionary(
      fc.string({ minLength: 1 }).filter((name) => name !== '__proto__'),
      fc.record({ expiresAt: fc.string(), npmrcPath: fc.string() }),
    ),
    current: fc.option(fc.string({ minLength: 1 }), { nil: null }),
  });

  test.prop([configArbitrary])('loads back exactly what was saved', (config) => {
    const configPath = path.join(home, 'roundtrip.json');

    saveConfig(configPath, config);

    expect(loadConfig(configPath)).toEqual(config);
  });
});
