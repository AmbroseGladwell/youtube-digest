import { ANALYTICS_PURPOSES, currentPurposes, type PurposesChange } from "../analyticsPurposes.js";
import type { AnalyticsConsent } from "../types/AnalyticsConsent.js";

// A yes counts only for the list it answered: until a reader says yes to what was added,
// nothing is sent for them.
export const consentAllowsSharing = (
  consent: AnalyticsConsent | null,
  purposes: readonly PurposesChange[] = ANALYTICS_PURPOSES,
): boolean => consent?.answer === "share" && consent.purposesVersion >= currentPurposes(purposes).version;

// An answer given to a list of what is counted that has since grown: onboarding asks it
// again, and Settings › Privacy shows it as off (docs/features/analytics-consent.md, "When
// what is counted changes").
export const consentOutdated = (
  consent: AnalyticsConsent | null,
  purposes: readonly PurposesChange[] = ANALYTICS_PURPOSES,
): boolean => consent !== null && consent.purposesVersion < currentPurposes(purposes).version;
