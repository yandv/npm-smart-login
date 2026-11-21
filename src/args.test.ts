import { describe, expect, it } from 'vitest';
import { parseArgs } from './args.js';

describe('parseArgs', () => {
  it('parses login', () => {
    expect(parseArgs(['login'])).toEqual({ name: 'login' });
  });

  it('parses check', () => {
    expect(parseArgs(['check'])).toEqual({ name: 'check' });
  });

  it('parses switch with its account', () => {
    expect(parseArgs(['switch', 'work'])).toEqual({ name: 'switch', account: 'work' });
  });

  it('asks for an account when switch has none', () => {
    expect(parseArgs(['switch'])).toEqual({ name: 'usage-error', message: 'Uso: npm-smart-login switch <conta>' });
  });

  it('parses exec with the account and the whole command', () => {
    expect(parseArgs(['exec', 'work', 'pnpm', 'publish', '--tag', 'next'])).toEqual({
      name: 'exec',
      account: 'work',
      command: ['pnpm', 'publish', '--tag', 'next'],
    });
  });

  it('parses exec without a command as an empty command', () => {
    expect(parseArgs(['exec', 'work'])).toEqual({ name: 'exec', account: 'work', command: [] });
  });

  it('asks for an account when exec has none', () => {
    expect(parseArgs(['exec'])).toEqual({ name: 'usage-error', message: 'Uso: npm-smart-login exec <conta> <comando>' });
  });

  it('shows help for an unknown command', () => {
    expect(parseArgs(['deploy', 'work'])).toEqual({ name: 'help' });
  });

  it('shows help when there are no arguments', () => {
    expect(parseArgs([])).toEqual({ name: 'help' });
  });
});
