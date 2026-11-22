import {
  FallbackCause,
  type GenerationKey,
  type KeySource,
  type MadeOn,
  type ModelId,
  type Overview,
  type OverviewId,
  type ProjectId,
  type Provider,
} from "@overview/domain";
import { fallbackReasonOf, generateOverviewOf, type GenerationClient, type OverviewInput } from "@overview/generation";
import { isSyncRequestError, type GenerationApi } from "@overview/sync";
import { ChosenModelFailedError, failedOnTheModel } from "./ChosenModelFailedError.js";

export interface OverviewKeys {
  order: KeySource[];
  own: { provider: Provider; model: string; client: GenerationClient } | null;
  // Null signed out, where nothing is made on us (OV-327).
  api: GenerationApi | null;
  ourModel?: { provider: Provider; model: ModelId } | null;
}

// The last attempt before a run settles is the one that made or failed it (OV-255).
export interface GenerationAttempt {
  key: GenerationKey;
  provider: Provider | undefined;
  model: string | undefined;
}

export interface OverviewMeta {
  id: OverviewId;
  savedAt: string;
  onAttempt?: ((attempt: GenerationAttempt) => void) | undefined;
  onProjectsFiled?: ((projectIds: ProjectId[]) => void) | undefined;
}

const SPENT_QUOTAS = new Set(["ours", "own"]);

// Null is a failure the reader has to see, such as a refused key, rather than a reason to try the next.
export const fallbackCauseOf = (error: unknown): FallbackCause | null => {
  if (isSyncRequestError(error)) {
    switch (error.code) {
      case "too_many_requests":
        if (error.details?.quota === "our-key-daily") {
          return "busy";
        }
        return SPENT_QUOTAS.has(String(error.details?.quota)) ? "quota-spent" : null;
      case "generation_failed":
        return FallbackCause.safeParse(error.details?.fallback).data ?? null;
      case "unavailable":
        return "provider-down";
      default:
        return null;
    }
  }
  return fallbackReasonOf(error);
};

// docs/architecture/tiers.md, "Which key an overview uses".
export const makeOverviewOnKeys = async (
  { order, own, api, ourModel = null }: OverviewKeys,
  input: OverviewInput,
  meta: OverviewMeta,
): Promise<Overview> => {
  let passedOver: MadeOn["fallback"] = null;
  for (const [index, key] of order.entries()) {
    meta.onAttempt?.(
      key === "own"
        ? { key, provider: own!.provider, model: own!.model }
        : { key: "ours", provider: ourModel?.provider, model: ourModel?.model },
    );
    try {
      const overview = key === "own" ? await onOwnKey(own!, api, input, meta) : await onOurKey(api, input, meta);
      return { ...overview, madeOn: { key, fallback: passedOver } };
    } catch (error) {
      const cause = fallbackCauseOf(error);
      if (cause === null || index === order.length - 1) {
        throw key === "own" && failedOnTheModel(error) ? new ChosenModelFailedError(own!.provider, own!.model, error) : error;
      }
      passedOver = { from: key, provider: own?.provider ?? null, cause };
    }
  }
  throw new Error("There is no key to make this overview with.");
};

const onOurKey = async (api: Pick<GenerationApi, "generate"> | null, input: OverviewInput, meta: OverviewMeta): Promise<Overview> => {
  if (api === null) {
    throw new Error("An overview is made on us only with an account.");
  }
  const { filedProjectIds, ...overview } = await api.generate({ overviewId: meta.id, input });
  meta.onProjectsFiled?.(filedProjectIds);
  return overview;
};

const onOwnKey = async (
  own: NonNullable<OverviewKeys["own"]>,
  api: GenerationApi | null,
  input: OverviewInput,
  meta: OverviewMeta,
): Promise<Overview> => {
  // Only a spent quota stops the own key: offline, the overview is made and its push reserves.
  try {
    await api?.reserve(meta.id);
  } catch (error) {
    if (fallbackCauseOf(error) === "quota-spent") {
      throw error;
    }
  }
  try {
    return await generateOverviewOf(own.client, input, meta, meta.onProjectsFiled ? { projectsFiled: meta.onProjectsFiled } : {});
  } catch (error) {
    await api?.release(meta.id).catch(() => undefined);
    throw error;
  }
};
