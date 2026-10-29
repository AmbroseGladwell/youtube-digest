import { ANALYTICS_PURPOSES, currentPurposes, type PurposesChange } from "../analyticsPurposes.js";
import type { AnalyticsConsent } from "../types/AnalyticsConsent.js";

// docs/features/analytics-consent.md, "When what is counted changes".
export const consentOutdated = (
  consent: AnalyticsConsent | null,
  purposes: readonly PurposesChange[] = ANALYTICS_PURPOSES,
): boolean => consent?.answer === "share" && consent.purposesVersion < currentPurposes(purposes).version;

export const consentAnswered = (
  consent: AnalyticsConsent | null,
  purposes: readonly PurposesChange[] = ANALYTICS_PURPOSES,
): consent is AnalyticsConsent => consent !== null && !consentOutdated(consent, purposes);

export const consentAllowsSharing = (
  consent: AnalyticsConsent | null,
  purposes: readonly PurposesChange[] = ANALYTICS_PURPOSES,
): boolean => consentAnswered(consent, purposes) && consent.answer === "share";
