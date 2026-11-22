import { PROVIDER_LABEL, PROVIDER_SHORT_LABEL, PROVIDERS, type Provider } from "@overview/domain";
import type { Surface } from "../../app/SurfaceContext.js";
import type { GenerationReadiness } from "../newOverview/useGenerationReadiness.js";

// Never softened to "here": which device holds the key is the point of the sentence (design 110g).
export const deviceWord = (surface: Surface, isPhone: boolean): string => {
  if (surface === "extension") {
    return "the extension";
  }
  return isPhone ? "this phone" : "this computer";
};

export const PROVIDER_CHOICE_LINE = `Use one from ${PROVIDERS.map((provider) => PROVIDER_LABEL[provider])
  .slice(0, -1)
  .join(", ")} or ${PROVIDER_LABEL[PROVIDERS[PROVIDERS.length - 1] as Provider]}.`;

// In one place so the four surfaces that render these cannot drift apart.
export type KeyPrompt =
  | { kind: "no-key"; heading: string; detail: string }
  | { kind: "wrong-device"; heading: string; detail: string; provider: Provider; fallback: Provider; footnote: string };

export interface KeyPromptOptions {
  surface: Surface;
  isPhone: boolean;
  detail: string;
}

export const keyPrompt = (readiness: GenerationReadiness, { surface, isPhone, detail }: KeyPromptOptions): KeyPrompt | null => {
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
};

export const sentenceCase = (words: string): string => `${words.charAt(0).toUpperCase()}${words.slice(1)}`;

export const addKeyLabel = (provider: Provider): string => `Add ${PROVIDER_SHORT_LABEL[provider]} key`;

export const useInsteadLabel = (provider: Provider): string => `Use ${PROVIDER_SHORT_LABEL[provider]} instead`;

export const ADD_A_KEY_IN_SETTINGS = "Add a key in Settings";
