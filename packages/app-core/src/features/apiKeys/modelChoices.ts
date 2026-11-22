import { KNOWN_MODELS, estimatedOverviewCents, type KnownModel, type Provider } from "@overview/domain";
import type { ModelCatalogue } from "./ModelCatalogue.js";

export interface ModelChoice {
  id: string;
  label: string;
  description: string | null;
  cents: number | null;
}

const asChoice = (provider: Provider, model: KnownModel): ModelChoice => ({
  id: model.id,
  label: model.label,
  description: model.description,
  cents: estimatedOverviewCents(model),
});

// How the picker shows each group: docs/features/byo-providers.md, "Which models are offered".
export interface ModelChoices {
  recommended: ModelChoice[];
  rest: ModelChoice[];
  unusable: number;
  source: "live" | "known";
}

export const modelChoices = (provider: Provider, catalogue: ModelCatalogue | undefined): ModelChoices => {
  const recommended = KNOWN_MODELS[provider].map((model) => asChoice(provider, model));

  if (catalogue === undefined) {
    return { recommended, rest: [], unusable: 0, source: "known" };
  }

  const named = new Set(recommended.map((choice) => choice.id));
  return {
    recommended,
    rest: catalogue.usable.filter((id) => !named.has(id)).map((id) => ({ id, label: id, description: null, cents: null })),
    unusable: catalogue.unusable,
    source: "live",
  };
};

export const matchingChoices = (choices: ModelChoice[], search: string): ModelChoice[] => {
  const needle = search.trim().toLowerCase();
  if (needle === "") {
    return choices;
  }
  return choices.filter((choice) => choice.id.toLowerCase().includes(needle) || choice.label.toLowerCase().includes(needle));
};
