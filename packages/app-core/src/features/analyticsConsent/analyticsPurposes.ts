// Every change to what is counted, oldest first (docs/features/analytics-consent.md).
export interface PurposesChange {
  version: number;
}

export const ANALYTICS_PURPOSES: readonly PurposesChange[] = [{ version: 1 }];

export const currentPurposes = (purposes: readonly PurposesChange[] = ANALYTICS_PURPOSES): PurposesChange =>
  purposes[purposes.length - 1]!;
