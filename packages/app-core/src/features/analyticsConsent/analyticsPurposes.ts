// Oldest first: docs/features/analytics-consent.md, "When what is counted changes".
export interface PurposesChange {
  version: number;
}

export const ANALYTICS_PURPOSES: readonly PurposesChange[] = [{ version: 1 }];

export const currentPurposes = (purposes: readonly PurposesChange[] = ANALYTICS_PURPOSES): PurposesChange => purposes[purposes.length - 1]!;
