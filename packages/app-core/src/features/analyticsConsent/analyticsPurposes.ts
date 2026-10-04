// Every change to what is counted, oldest first. The first is what the prompt first asks
// about; each one after it asks every reader again, yes or no, and its words fill design
// 62b's "Now including …" (docs/features/analytics-consent.md).
export interface PurposesChange {
  version: number;
  added: string | null;
}

export const ANALYTICS_PURPOSES: readonly PurposesChange[] = [{ version: 1, added: null }];

export const currentPurposes = (purposes: readonly PurposesChange[] = ANALYTICS_PURPOSES): PurposesChange =>
  purposes[purposes.length - 1]!;
