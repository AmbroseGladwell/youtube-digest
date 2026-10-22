import { PROVIDER_SHORT_LABEL, type FallbackCause, type MadeOn } from "@overview/domain";

const PASSED_OVER_OWN: Record<FallbackCause, (provider: string) => string> = {
  "out-of-credit": (provider) => `your ${provider} key was out of credit`,
  "provider-down": (provider) => `${provider} wasn’t answering`,
  "schema-failure": (provider) => `${provider}’s answer came back malformed`,
  "quota-spent": () => "you’d made this month’s overviews on your own key",
  busy: (provider) => `${provider} wasn’t answering`,
};

const PASSED_OVER_OURS: Record<FallbackCause, string> = {
  "quota-spent": "you’d made this month’s overviews on our key",
  busy: "our key had made all it can today",
  "provider-down": "our key wasn’t answering",
  "out-of-credit": "our key wasn’t answering",
  "schema-failure": "our key’s answer came back malformed",
};

// The one quiet line a fallback earns, and nothing for an overview the first key made
// (docs/architecture/tiers.md, "Which key an overview uses").
export function madeOnLine(madeOn: MadeOn | null): string | null {
  const fallback = madeOn?.fallback ?? null;
  if (madeOn === null || fallback === null) return null;
  const provider = fallback.provider === null ? null : PROVIDER_SHORT_LABEL[fallback.provider];
  if (madeOn.key === "ours") {
    return `Made on our key: ${PASSED_OVER_OWN[fallback.cause](provider ?? "your provider")}`;
  }
  return `Made on ${provider === null ? "your own key" : `your ${provider} key`}: ${PASSED_OVER_OURS[fallback.cause]}`;
}
