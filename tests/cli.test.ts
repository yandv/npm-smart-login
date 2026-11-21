import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execa } from 'execa';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('cli', () => {
  let home: string;

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'nsl-cli-'));
  });

  afterEach(() => {
    fs.rmSync(home, { recursive: true, force: true });
  });

  // Runs the real entry point with a throwaway HOME so the real ~/.npmrc is never touched.
  function runCli(...args: string[]) {
    return execa('node', ['dist/cli.js', ...args], { reject: false, env: { HOME: home, USERPROFILE: home } });
  }

  function writeConfigExpiringAt(expiresAt: Date) {
    fs.writeFileSync(
      path.join(home, '.npm-smart-login.json'),
      JSON.stringify({ accounts: { work: { expiresAt: expiresAt.toISOString(), npmrcPath: '' } }, current: 'work' }),
    );
  }

  it('prints the usage for an unknown command', async () => {
    const result = await runCli('deploy');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('Uso: npm-smart-login <login | switch <conta> | exec <conta> <cmd> | check>');
  });

  it('fails switch without an account', async () => {
    const result = await runCli('switch');

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('Uso: npm-smart-login switch <conta>');
  });

  it('fails exec without an account', async () => {
    const result = await runCli('exec');

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('Uso: npm-smart-login exec <conta> <comando>');
  });

  it('switches to a new account inside the given home', async () => {
    const result = await runCli('switch', 'work');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('Criando novo perfil: work...\n✅ Trocado para a conta: work');
    expect(fs.readlinkSync(path.join(home, '.npmrc'))).toBe(path.join(home, '.npmrc-work'));
  });

  it('refuses to exec on an account that does not exist', async () => {
    const result = await runCli('exec', 'ghost', 'node', '-v');

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe(`❌ A conta 'ghost' não existe. Crie-a primeiro com "npm-smart-login switch ghost".`);
  });

  it('refuses to exec without a command', async () => {
    await runCli('switch', 'work');

    const result = await runCli('exec', 'work');

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('❌ Forneça o comando a ser executado. Ex: npm-smart-login exec trabalho pnpm publish');
  });

  it('runs a command with the profile of the chosen account', async () => {
    await runCli('switch', 'work');
    await runCli('switch', 'personal');

    const result = await runCli('exec', 'work', 'node', '-p', 'process.env.NPM_CONFIG_USERCONFIG');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(path.join(home, '.npmrc-work'));
  });

  it('fails when the executed command fails', async () => {
    await runCli('switch', 'work');

    const result = await runCli('exec', 'work', 'node', '-e', 'process.exit(3)');

    expect(result.exitCode).toBe(1);
  });

  it('prints nothing on check without any config', async () => {
    const result = await runCli('check');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('warns on check when the token expires in 13 days', async () => {
    writeConfigExpiringAt(new Date(Date.now() + 13 * DAY_MS));

    const result = await runCli('check');

    expect(result.stdout).toBe(" ⚠️ AVISO: Seu token do NPM para a conta 'work' vai expirar em 13 dia(s)! ");
  });

  it('prints nothing on check when the token expires in 30 days', async () => {
    writeConfigExpiringAt(new Date(Date.now() + 30 * DAY_MS));

    const result = await runCli('check');

    expect(result.stdout).toBe('');
  });

  it('reports on check that the token already expired', async () => {
    writeConfigExpiringAt(new Date(Date.now() - DAY_MS));

    const result = await runCli('check');

    expect(result.stdout).toBe(` ⚠️ SEU LOGIN DO NPM EXPIROU NA CONTA 'work'! Rode "npm-smart-login login" para renovar. `);
  });
});
