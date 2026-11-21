import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execa } from 'execa';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isIncorrectPasswordLog } from '../src/token-output.js';

const DELETE_CALL = 'config delete --global //registry.npmjs.org/:_authToken\n';

describe('pnpm auth.ini guard', () => {
  let home: string;
  let binDir: string;
  let callsLog: string;

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'nsl-pnpm-'));
    binDir = path.join(home, 'bin');
    callsLog = path.join(home, 'pnpm-calls.log');
    fs.mkdirSync(binDir);
  });

  afterEach(() => {
    fs.rmSync(home, { recursive: true, force: true });
  });

  // A fake pnpm first on PATH logs its arguments, so the real pnpm and its config are never touched.
  function installFakePnpm(getOutput: string) {
    fs.writeFileSync(
      path.join(binDir, 'pnpm'),
      `#!/bin/sh\necho "$@" >> "${callsLog}"\nif [ "$2" = "get" ]; then echo "${getOutput}"; fi\n`,
      { mode: 0o755 },
    );
  }

  function runCli(...args: string[]) {
    return execa('node', ['dist/cli.js', ...args], {
      reject: false,
      env: { HOME: home, USERPROFILE: home, PATH: `${binDir}:${process.env.PATH}` },
    });
  }

  function writeConfigExpiringIn30Days() {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    fs.writeFileSync(
      path.join(home, '.npm-smart-login.json'),
      JSON.stringify({ accounts: { work: { expiresAt, npmrcPath: '' } }, current: 'work' }),
    );
  }

  it('warns on check when pnpm holds its own token', async () => {
    writeConfigExpiringIn30Days();
    installFakePnpm('npm_stale-token');

    const result = await runCli('check');

    expect(result.stdout).toBe(
      ` ⚠️ O pnpm tem um token próprio (auth.ini) passando por cima da conta 'work'. Rode "npm-smart-login switch work" para remover. `,
    );
  });

  it('stays silent on check when pnpm reports no token', async () => {
    writeConfigExpiringIn30Days();
    installFakePnpm('undefined');

    const result = await runCli('check');

    expect(result.stdout).toBe('');
  });

  it('removes the pnpm token when switching accounts', async () => {
    installFakePnpm('');

    await runCli('switch', 'work');

    expect(fs.readFileSync(callsLog, 'utf8')).toBe(DELETE_CALL);
  });

  it('removes the pnpm token before running a command with exec', async () => {
    installFakePnpm('');
    await runCli('switch', 'work');
    fs.unlinkSync(callsLog);

    const result = await runCli('exec', 'work', 'node', '-p', '1');

    expect(result.stdout).toBe('1');
    expect(fs.readFileSync(callsLog, 'utf8')).toBe(DELETE_CALL);
  });

  it('leaves pnpm alone when exec targets an account that does not exist', async () => {
    installFakePnpm('');

    await runCli('exec', 'ghost', 'node', '-v');

    expect(fs.existsSync(callsLog)).toBe(false);
  });
});

describe('incorrect password detection', () => {
  it('recognizes the npm message in the captured log', () => {
    expect(isIncorrectPasswordLog('npm error code E401\nnpm error Incorrect password.')).toBe(true);
  });

  it('ignores logs without the message', () => {
    expect(isIncorrectPasswordLog('npm error code EOTP')).toBe(false);
  });
});
