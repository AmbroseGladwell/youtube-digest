// Every change to what is counted, oldest first. A yes counts only for the list it answered,
// so adding one stops sending for readers without an account until they say yes again in
// Settings › Privacy (docs/features/analytics-consent.md, "When what is counted changes").
export interface PurposesChange {
  version: number;
}

export const ANALYTICS_PURPOSES: readonly PurposesChange[] = [{ version: 1 }];

export const currentPurposes = (purposes: readonly PurposesChange[] = ANALYTICS_PURPOSES): PurposesChange =>
  purposes[purposes.length - 1]!;
