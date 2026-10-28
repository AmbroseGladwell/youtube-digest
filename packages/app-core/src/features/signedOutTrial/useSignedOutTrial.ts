import { readSignedOutTrial, writeSignedOutTrial } from "./signedOutTrialStorage.js";
import type { SignedOutTrial } from "./types/SignedOutTrial.js";

// Read once and kept, since the trial generation API reads and writes the token and a run
// reads it to fetch a transcript.
let snapshot: SignedOutTrial | null = null;

export function currentSignedOutTrial(): SignedOutTrial {
  snapshot ??= readSignedOutTrial();
  return snapshot;
}

function update(change: Partial<SignedOutTrial>): void {
  const next = { ...currentSignedOutTrial(), ...change };
  writeSignedOutTrial(next);
  snapshot = next;
}

export const rememberTrialToken = (token: string): void => update({ token });
export const forgetTrialToken = (): void => update({ token: null });
