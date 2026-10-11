import { KNOWN_MODELS, estimatedOverviewCents, type KnownModel, type Provider } from "@overview/domain";
import type { ModelCatalogue } from "./ModelCatalogue.js";

// A model offered in the picker. The few we have pointed at a transcript carry a
// description and a rough price; the rest carry their raw id and nothing else, and the
// picker says why (design 110e).
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

export interface ModelChoices {
  // The handful we describe. Always shown, whether or not the provider answered.
  recommended: ModelChoice[];
  // Everything else the key reaches, by the name the provider lists it under. Empty when
  // the catalogue call failed, in which case the group is dropped rather than shown empty.
  rest: ModelChoice[];
  // How many the provider listed that could not write an overview, so the picker can say
  // what it is not showing instead of silently hiding it.
  unusable: number;
  // Whether these came from the reader's own key or from the list we keep. Drives the one
  // muted line in design 110h, and nothing else: a fallback list is not an error.
  source: "live" | "known";
}

export function modelChoices(provider: Provider, catalogue: ModelCatalogue | undefined): ModelChoices {
  const recommended = KNOWN_MODELS[provider].map((model) => asChoice(provider, model));

  if (catalogue === undefined) {
    return { recommended, rest: [], unusable: 0, source: "known" };
  }

  const named = new Set(recommended.map((choice) => choice.id));
  return {
    recommended,
    rest: catalogue.usable
      .filter((id) => !named.has(id))
      .map((id) => ({ id, label: id, description: null, cents: null })),
    unusable: catalogue.unusable,
    source: "live",
  };
}

// Search covers both groups (design 110e, third frame): a reader typing "mini" is looking
// for a model, not for a group.
export const matchingChoices = (choices: ModelChoice[], search: string): ModelChoice[] => {
  const needle = search.trim().toLowerCase();
  if (needle === "") {
    return choices;
  }
  return choices.filter(
    (choice) => choice.id.toLowerCase().includes(needle) || choice.label.toLowerCase().includes(needle),
  );
};
