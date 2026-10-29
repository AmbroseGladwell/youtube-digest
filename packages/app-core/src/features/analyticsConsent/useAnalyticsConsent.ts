import { useSyncExternalStore } from "react";
import { currentPurposes } from "./analyticsPurposes.js";
import { consentAllowsSharing } from "./util/consentAllowsSharing.js";
import { readAnalyticsConsent, writeAnalyticsConsent } from "./analyticsConsentStorage.js";
import type { AnalyticsConsent, ConsentAnswer } from "./types/AnalyticsConsent.js";

export interface AnalyticsConsentState {
  consent: AnalyticsConsent | null;
}

// One shared snapshot, as useSyncConnection keeps: an answer writes it, and the
// analytics queue has to see a yes before the event recording it is sent.
const listeners = new Set<() => void>();
let snapshot: AnalyticsConsentState | null = null;

export function analyticsConsentSnapshot(): AnalyticsConsentState {
  snapshot ??= { consent: readAnalyticsConsent() };
  return snapshot;
}

function update(next: AnalyticsConsentState): void {
  if (next.consent !== analyticsConsentSnapshot().consent) writeAnalyticsConsent(next.consent);
  snapshot = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// A yes always makes a new id: one that was deleted by a no is never used again.
export function answerAnalyticsConsent(answer: ConsentAnswer, now: Date = new Date()): void {
  update({
    consent: {
      answer,
      answeredAt: now.toISOString(),
      purposesVersion: currentPurposes().version,
      anonymousId: answer === "share" ? crypto.randomUUID() : null,
    },
  });
}

// A no after a live yes is a withdrawal, not a decline (docs/features/analytics-consent.md).
export function declineAnalyticsConsent(now: Date = new Date()): { declined: boolean } {
  const sharing = consentAllowsSharing(analyticsConsentSnapshot().consent);
  answerAnalyticsConsent("dontShare", now);
  return { declined: !sharing };
}

// The id belongs to whoever uses this device with no account, so a sign-in drops it and the
// next reader signed out here gets a new one (docs/features/analytics-consent.md).
export function forgetAnonymousId(): void {
  const state = analyticsConsentSnapshot();
  if (state.consent?.anonymousId == null) return;
  update({ ...state, consent: { ...state.consent, anonymousId: null } });
}

export function mintAnonymousId(): void {
  const state = analyticsConsentSnapshot();
  const { consent } = state;
  if (consent === null || !consentAllowsSharing(consent) || consent.anonymousId !== null) return;
  update({ ...state, consent: { ...consent, anonymousId: crypto.randomUUID() } });
}

export function useAnalyticsConsent(): AnalyticsConsentState {
  return useSyncExternalStore(subscribe, analyticsConsentSnapshot);
}
