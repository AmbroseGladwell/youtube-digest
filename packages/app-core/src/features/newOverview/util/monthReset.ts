// The moment the month's counts reset: UTC midnight on the server's `resetsOn`, or on the first
// of next month when it gave none (docs/architecture/tiers.md, "Counting").
export function monthResetOf(resetsOn: string | null, now: Date): Date {
  if (resetsOn !== null && /^\d{4}-\d{2}-\d{2}$/.test(resetsOn)) return new Date(`${resetsOn}T00:00:00Z`);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}
