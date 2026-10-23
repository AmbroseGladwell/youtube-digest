import { FallbackCause, type KeySource, type MadeOn, type Overview, type OverviewId, type Provider } from "@overview/domain";
import { fallbackReasonOf, generateOverview, type GenerationClient, type GenerationInput } from "@overview/generation";
import { isSyncRequestError, type GenerationApi } from "@overview/sync";

export interface OverviewKeys {
  order: KeySource[];
  // The reader's own key, when they have one on this device.
  own: { provider: Provider; client: GenerationClient } | null;
  // Our server, for a signed-in reader: our key, and the reservations an own-key overview
  // takes on the account's month. Null signed out, where nothing is counted by the server.
  api: GenerationApi | null;
}

export interface OverviewMeta {
  id: OverviewId;
  savedAt: string;
}

// Why a key couldn't make the overview, when that is a reason to try the next one. Null is
// a failure the reader has to see, such as a refused key (design 110f).
export function fallbackCauseOf(error: unknown): FallbackCause | null {
  if (isSyncRequestError(error)) {
    switch (error.code) {
      case "too_many_requests":
        if (error.details?.quota === "our-key-daily") return "busy";
        return error.details?.quota === "ours" || error.details?.quota === "own" ? "quota-spent" : null;
      case "generation_failed":
        return FallbackCause.safeParse(error.details?.fallback).data ?? null;
      case "unavailable":
        return "provider-down";
      default:
        return null;
    }
  }
  return fallbackReasonOf(error);
}

// The overview made on the first key that can, saying which one and why any before it were
// passed over (docs/architecture/tiers.md, "Which key an overview uses"). Each attempt
// counts on its own key and gives its slot back when it fails, so a fallback counts once,
// on the key that made it.
export async function makeOverviewOnKeys(
  { order, own, api }: OverviewKeys,
  input: GenerationInput,
  meta: OverviewMeta,
): Promise<Overview> {
  let passedOver: MadeOn["fallback"] = null;
  for (const [index, key] of order.entries()) {
    try {
      const overview = key === "own" ? await onOwnKey(own!, api, input, meta) : await api!.generate({ overviewId: meta.id, input });
      return { ...overview, madeOn: { key, fallback: passedOver } };
    } catch (error) {
      const cause = fallbackCauseOf(error);
      if (cause === null || index === order.length - 1) throw error;
      passedOver = { from: key, provider: own?.provider ?? null, cause };
    }
  }
  throw new Error("There is no key to make this overview with.");
}

async function onOwnKey(
  own: NonNullable<OverviewKeys["own"]>,
  api: GenerationApi | null,
  input: GenerationInput,
  meta: OverviewMeta,
): Promise<Overview> {
  // Only a spent quota stops the reader's own key. Offline, or with the server down, the
  // overview is made anyway and its push reserves when it goes (docs/features/sync-client.md).
  try {
    await api?.reserve(meta.id);
  } catch (error) {
    if (fallbackCauseOf(error) === "quota-spent") throw error;
  }
  try {
    return await generateOverview(own.client, input, meta);
  } catch (error) {
    await api?.release(meta.id).catch(() => undefined);
    throw error;
  }
}
