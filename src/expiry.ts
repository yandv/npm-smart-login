export const TOKEN_LIFETIME_DAYS = 90;
const WARNING_THRESHOLD_DAYS = 14;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

export type ExpiryStatus =
  | { kind: 'expired' }
  | { kind: 'expiring'; daysLeft: number };

export function calculateExpiry(now: Date): Date {
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + TOKEN_LIFETIME_DAYS);
  return expiresAt;
}

export function checkExpiry(expiresAt: Date, now: Date): ExpiryStatus | null {
  if (expiresAt < now) return { kind: 'expired' };

  const daysLeft = Math.ceil(Math.abs(expiresAt.getTime() - now.getTime()) / MS_PER_DAY);
  if (expiresAt.getTime() > now.getTime() && daysLeft <= WARNING_THRESHOLD_DAYS) {
    return { kind: 'expiring', daysLeft };
  }
  return null;
}
