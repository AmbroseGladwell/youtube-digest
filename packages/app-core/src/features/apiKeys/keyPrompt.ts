import { PROVIDER_LABEL, PROVIDER_SHORT_LABEL, PROVIDERS, type Provider } from "@overview/domain";
import type { Surface } from "../../app/SurfaceContext.js";
import type { GenerationReadiness } from "../newOverview/useGenerationReadiness.js";
import { TRIAL_SPENT_DETAIL, TRIAL_SPENT_HEADING } from "../signedOutTrial/trialPrompt.js";

// What this device is called in a sentence about where a key lives. The distinction is the
// whole point of the sentence, so it is not softened to "here" (design 110g).
export const deviceWord = (surface: Surface, isPhone: boolean): string =>
  surface === "extension" ? "the extension" : isPhone ? "this phone" : "this computer";

// "Anthropic, OpenAI, Google Gemini, DeepSeek, xAI Grok or Mistral" — the six named in
// full, once, where a reader with no key at all needs to know what would count
// (design 110k).
export const PROVIDER_CHOICE_LINE = `Use one from ${PROVIDERS.map((provider) => PROVIDER_LABEL[provider])
  .slice(0, -1)
  .join(", ")} or ${PROVIDER_LABEL[PROVIDERS[PROVIDERS.length - 1] as Provider]}.`;

// The ways a reader can be unable to generate, each with its own words and its own way
// out. Kept together so the four surfaces that render them cannot drift apart
// (designs 110k, 110l, 110m). A spent signed-out trial comes first: no key gets round it
// (docs/architecture/tiers.md, "At the limit").
export type KeyPrompt =
  | { kind: "trial-spent"; heading: string; detail: string }
  | { kind: "no-key"; heading: string; detail: string }
  | { kind: "wrong-device"; heading: string; detail: string; provider: Provider; fallback: Provider; footnote: string };

export function keyPrompt(
  readiness: GenerationReadiness,
  { surface, isPhone, detail }: { surface: Surface; isPhone: boolean; detail: string },
): KeyPrompt | null {
  if (readiness.trialSpent) {
    return { kind: "trial-spent", heading: TRIAL_SPENT_HEADING, detail: TRIAL_SPENT_DETAIL };
  }
  if (readiness.hasChosenKey) {
    return null;
  }

  const here = deviceWord(surface, isPhone);
  const chosen = PROVIDER_SHORT_LABEL[readiness.provider];

  if (readiness.fallback === null) {
    return { kind: "no-key", heading: "Add an API key to write overviews.", detail };
  }

  const fallbackName = PROVIDER_SHORT_LABEL[readiness.fallback];
  return {
    kind: "wrong-device",
    heading: `You generate with ${chosen}, and ${here} has no ${chosen} key.`,
    detail:
      `Keys stay on the device they were added on. Add your ${chosen} key here too, or ` +
      `generate with ${fallbackName}, which ${here} has.`,
    provider: readiness.provider,
    fallback: readiness.fallback,
    footnote: `Using ${fallbackName} changes the choice on every device.`,
  };
}

export const sentenceCase = (words: string): string => `${words.charAt(0).toUpperCase()}${words.slice(1)}`;

export const addKeyLabel = (provider: Provider): string => `Add ${PROVIDER_SHORT_LABEL[provider]} key`;

export const useInsteadLabel = (provider: Provider): string => `Use ${PROVIDER_SHORT_LABEL[provider]} instead`;

export const ADD_A_KEY_IN_SETTINGS = "Add a key in Settings";
