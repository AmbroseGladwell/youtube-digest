import type { AnalyticsConsent } from "../types/AnalyticsConsent.js";

// Who the switch in Settings › Privacy speaks for: a reader without an account, whose answer
// is consent kept on this device, or an account, whose switch is an opt-out kept on the
// account (docs/features/analytics-consent.md, "Settings › Privacy").
export type ShareUsageState =
  | { signedIn: false; consent: AnalyticsConsent | null; outdated: boolean }
  | { signedIn: true; optedOut: boolean; changedAt: string | null };

const MONTH = new Intl.DateTimeFormat("en-GB", { month: "long" });

export function sinceDay(iso: string, now: Date): string {
  const date = new Date(iso);
  if (date.toDateString() === now.toDateString()) return "today";
  return `${date.getDate()} ${MONTH.format(date)} ${date.getFullYear()}`;
}

export function shareUsageOn(state: ShareUsageState): boolean {
  return state.signedIn ? !state.optedOut : state.consent?.answer === "share";
}

// Design 62d–62h: the line under "Share usage", which is the switch's description.
export function shareUsageStatus(state: ShareUsageState, now: Date): string {
  if (state.signedIn) {
    const since = state.changedAt === null ? "" : ` since ${sinceDay(state.changedAt, now)}`;
    return state.optedOut ? `Off across your devices${since}` : `On across your devices${since}`;
  }
  if (state.outdated) return "Share usage now covers more. Nothing new is shared until you choose.";
  if (state.consent === null) return "You haven’t chosen yet, so nothing is shared.";
  const since = sinceDay(state.consent.answeredAt, now);
  return state.consent.answer === "share" ? `On since ${since}` : `Off since ${since}`;
}

export function shareUsageRowValue(state: ShareUsageState): string {
  if (!state.signedIn && state.consent === null) return "Not chosen";
  return shareUsageOn(state) ? "Sharing usage" : "Not sharing usage";
}
