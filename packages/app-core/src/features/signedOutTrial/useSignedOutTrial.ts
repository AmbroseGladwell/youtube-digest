import { readSignedOutTrial, writeSignedOutTrial } from "./signedOutTrialStorage.js";
import type { SignedOutTrial } from "./types/SignedOutTrial.js";

let snapshot: SignedOutTrial | null = null;

export const currentSignedOutTrial = (): SignedOutTrial => {
  snapshot ??= readSignedOutTrial();
  return snapshot;
};

const update = (change: Partial<SignedOutTrial>): void => {
  const next = { ...currentSignedOutTrial(), ...change };
  writeSignedOutTrial(next);
  snapshot = next;
};

export const rememberTrialToken = (token: string): void => update({ token });
export const forgetTrialToken = (): void => update({ token: null });
