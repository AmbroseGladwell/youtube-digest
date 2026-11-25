// The month's counts turn with the UTC month (docs/architecture/tiers.md).
export const nextUsageMonth = (at: Date): Date => new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1));
