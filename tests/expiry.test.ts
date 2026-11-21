import { fc, test } from '@fast-check/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateExpiry, checkExpiry, type ExpiryStatus } from '../src/expiry.js';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('expiry', () => {
  const now = new Date('2026-03-10T12:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('warning threshold', () => {
    const cases: Array<[string, number, ExpiryStatus | null]> = [
      ['stays quiet with 15 days left', 15 * DAY_MS, null],
      ['stays quiet one millisecond past 14 days', 14 * DAY_MS + 1, null],
      ['warns with exactly 14 days left', 14 * DAY_MS, { kind: 'expiring', daysLeft: 14 }],
      ['warns with 13 days left', 13 * DAY_MS, { kind: 'expiring', daysLeft: 13 }],
      ['rounds a partial day up', 12 * DAY_MS + 1, { kind: 'expiring', daysLeft: 13 }],
      ['warns with one millisecond left', 1, { kind: 'expiring', daysLeft: 1 }],
      ['stays quiet when it expires exactly now', 0, null],
      ['reports expired one millisecond ago', -1, { kind: 'expired' }],
      ['reports expired a month ago', -30 * DAY_MS, { kind: 'expired' }],
    ];

    it.each(cases)('%s', (_name, offsetMs, expected) => {
      const expiresAt = new Date(Date.now() + offsetMs);

      expect(checkExpiry(expiresAt, new Date())).toEqual(expected);
    });
  });

  describe('token lifetime', () => {
    it('expires a new token 90 days from now', () => {
      expect(calculateExpiry(new Date()).toISOString()).toBe('2026-06-08T12:00:00.000Z');
    });

    it('crosses a year boundary', () => {
      expect(calculateExpiry(new Date('2026-11-15T12:00:00.000Z')).toISOString()).toBe('2027-02-13T12:00:00.000Z');
    });

    it('leaves the starting date untouched', () => {
      const start = new Date();

      calculateExpiry(start);

      expect(start.toISOString()).toBe('2026-03-10T12:00:00.000Z');
    });
  });

  describe('properties', () => {
    test.prop([fc.integer({ min: 1, max: 14 * DAY_MS })])('warns whenever 14 days or less remain', (remainingMs) => {
      const status = checkExpiry(new Date(Date.now() + remainingMs), new Date());

      expect(status?.kind).toBe('expiring');
    });

    test.prop([fc.integer({ min: 14 * DAY_MS + 1, max: 400 * DAY_MS })])('stays quiet with more than 14 days left', (remainingMs) => {
      expect(checkExpiry(new Date(Date.now() + remainingMs), new Date())).toBeNull();
    });

    test.prop([fc.integer({ min: 1, max: 400 * DAY_MS })])('reports expired for any past date', (agoMs) => {
      expect(checkExpiry(new Date(Date.now() - agoMs), new Date())).toEqual({ kind: 'expired' });
    });
  });
});
