import { fc, test } from '@fast-check/vitest';
import { describe, expect, it } from 'vitest';
import { buildAccessArgs, buildManualAccessArgs, listAccessTargets } from './token-scopes.js';

describe('token scopes', () => {
  describe('automatic access from searched packages', () => {
    it('grants a scope once for many packages under it', () => {
      expect(buildAccessArgs(['@acme/a', '@acme/b'])).toEqual(['--scopes', '@acme']);
    });

    it('grants unscoped packages by name', () => {
      expect(buildAccessArgs(['left-pad', 'is-odd'])).toEqual(['--packages', 'left-pad,is-odd']);
    });

    it('lists scopes before unscoped packages when both are present', () => {
      expect(buildAccessArgs(['left-pad', '@acme/a', '@beta/b'])).toEqual(['--scopes', '@acme,@beta', '--packages', 'left-pad']);
    });

    it('grants nothing for an empty search', () => {
      expect(buildAccessArgs([])).toEqual([]);
    });

    it('lists each target once in order of appearance', () => {
      expect(listAccessTargets(['@acme/a', 'left-pad', '@acme/b', 'left-pad'])).toEqual(['@acme', 'left-pad']);
    });
  });

  describe('manual access', () => {
    it('routes an @scope to the scopes flag', () => {
      expect(buildManualAccessArgs('@my-org')).toEqual(['--scopes', '@my-org']);
    });

    it('routes a plain name to the packages flag', () => {
      expect(buildManualAccessArgs('my-package')).toEqual(['--packages', 'my-package']);
    });
  });

  describe('properties', () => {
    const segment = fc.stringMatching(/^[a-z][a-z0-9-]{0,10}$/);
    const packageName = fc.oneof(
      segment,
      fc.tuple(segment, segment).map(([scope, name]) => `@${scope}/${name}`),
    );

    test.prop([fc.array(packageName)])('lists no target twice', (names) => {
      const targets = listAccessTargets(names);

      expect(new Set(targets).size).toBe(targets.length);
    });

    test.prop([fc.array(packageName)])('covers every searched package through its scope or its name', (names) => {
      const targets = listAccessTargets(names);

      expect(names.every((name) => targets.includes(name.startsWith('@') ? name.split('/')[0] ?? '' : name))).toBe(true);
    });
  });
});
