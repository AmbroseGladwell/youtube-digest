import { ANALYTICS_PURPOSES, currentPurposes, type PurposesChange } from "../analyticsPurposes.js";
import type { AnalyticsConsent } from "../types/AnalyticsConsent.js";

export type ConsentAsk = { kind: "first" } | { kind: "again"; added: string };

// Whether the prompt has a question to put: never answered, or answered to a list of what
// is counted that has since grown.
export function consentAskOf(
  consent: AnalyticsConsent | null,
  purposes: readonly PurposesChange[] = ANALYTICS_PURPOSES,
): ConsentAsk | null {
  if (consent === null) return { kind: "first" };
  const current = currentPurposes(purposes);
  if (consent.purposesVersion >= current.version) return null;
  return { kind: "again", added: current.added ?? "" };
}

// A yes counts only for the list it answered: until a reader says yes to what was added,
// nothing is sent for them.
export const consentAllowsSharing = (
  consent: AnalyticsConsent | null,
  purposes: readonly PurposesChange[] = ANALYTICS_PURPOSES,
): boolean => consent?.answer === "share" && consent.purposesVersion >= currentPurposes(purposes).version;
