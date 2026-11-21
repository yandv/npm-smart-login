import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';
import { extractToken, stripAnsi } from './token-output.js';

describe('token output', () => {
  const token = 'npm_' + 'aB3'.repeat(12);

  it('removes color codes from captured terminal output', () => {
    expect(stripAnsi('\x1B[32mgreen\x1B[0m and \x1B[1;31mbold red\x1B[0m')).toBe('green and bold red');
  });

  it('finds the token inside npm table output', () => {
    expect(extractToken(`│ token │ ${token} │\n│ cidr  │       │`)).toBe(token);
  });

  it('finds nothing when the token is redacted', () => {
    expect(extractToken('token: npm_***')).toBeNull();
  });

  it('finds nothing in a token that is too short', () => {
    expect(extractToken('npm_' + 'a'.repeat(35))).toBeNull();
  });

  it('keeps only the first 36 characters after the prefix', () => {
    expect(extractToken('npm_' + 'a'.repeat(40))).toBe('npm_' + 'a'.repeat(36));
  });

  const base62Token = fc.stringMatching(/^[a-zA-Z0-9]{36}$/).map((body) => `npm_${body}`);
  const colorCode = fc.stringMatching(/^[0-9]{1,2}(;[0-9]{1,2})?$/).map((code) => `\x1B[${code}m`);

  test.prop([base62Token, colorCode, colorCode])('recovers a token wrapped in color codes', (found, before, after) => {
    expect(extractToken(stripAnsi(`${before}${found}${after}`))).toBe(found);
  });

  test.prop([fc.string()])('strips color codes idempotently', (text) => {
    expect(stripAnsi(stripAnsi(text))).toBe(stripAnsi(text));
  });
});
