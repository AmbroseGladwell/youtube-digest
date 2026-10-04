import { useSync } from "../sync/SyncContext.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";
import { useAnalyticsConsent } from "./useAnalyticsConsent.js";
import { consentAskOf, type ConsentAsk } from "./util/consentAskOf.js";
import type { ConsentAnswer } from "./types/AnalyticsConsent.js";

export type AnalyticsConsentStrip = { kind: "prompt"; ask: ConsentAsk } | { kind: "notice"; answer: ConsentAnswer };

// What design 62's slot holds on the library or the panel's home: the question while a
// reader without an account has one to answer, then the notice of what they chose. A shell
// with no server to send to has nothing to ask (docs/features/analytics-consent.md).
export function useAnalyticsConsentStrip(onLibraryHome: boolean): AnalyticsConsentStrip | null {
  const { connected } = useSync();
  const apiUrl = useKnownApiUrl();
  const { consent, justAnswered } = useAnalyticsConsent();

  if (!onLibraryHome || connected || apiUrl === null) return null;
  if (justAnswered !== null) return { kind: "notice", answer: justAnswered };
  const ask = consentAskOf(consent);
  return ask === null ? null : { kind: "prompt", ask };
}
