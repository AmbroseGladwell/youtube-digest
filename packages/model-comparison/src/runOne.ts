import { randomUUID } from "node:crypto";
import { DEFAULT_SECTIONS_ENABLED, OverviewId } from "@overview/domain";
import {
  GenerationError,
  ProviderKeyRefusedError,
  ProviderRequestError,
  createGenerationClient,
  generateOverview,
  type GenerationClient,
  type GenerationInput,
  meteredFetch,
  type MeteredCall,
  costInDollars,
  priceOf,
} from "@overview/generation";
import type { FetchedTranscript } from "@overview/transcripts";
import type { ComparedModel } from "./ComparedModel.js";
import type { ReaderProfile } from "./ReaderProfile.js";
import type { RunOutcome, RunRecord } from "./RunRecord.js";

export interface RunOneOptions {
  model: ComparedModel;
  apiKey: string;
  fetched: FetchedTranscript;
  profile?: ReaderProfile;
  http?: typeof fetch;
  now?: () => number;
}

export const comparisonInput = (fetched: FetchedTranscript): GenerationInput => ({
  video: fetched.video,
  transcript: fetched.transcript,
  captureReason: null,
  readerContext: null,
  sectionsEnabled: DEFAULT_SECTIONS_ENABLED,
  existingTopics: [],
  pastClaims: [],
  existingTags: [],
  tagAliases: {},
});

export function measuredCost(model: ComparedModel, calls: MeteredCall[]): number | null {
  const price = priceOf(model);
  const answered = calls.filter((call) => call.status >= 200 && call.status < 300);
  if (price === undefined || answered.some((call) => call.usage === null)) return null;
  return answered.reduce((total, call) => total + costInDollars(price, call.usage!), 0);
}

export const isTheModelsDoing = (error: unknown): boolean =>
  error instanceof SyntaxError ||
  (error instanceof GenerationError &&
    !(error instanceof ProviderRequestError) &&
    !(error instanceof ProviderKeyRefusedError));

export async function runOne({
  model,
  apiKey,
  fetched,
  profile,
  http = globalThis.fetch.bind(globalThis),
  now = () => performance.now(),
}: RunOneOptions): Promise<RunRecord> {
  const metered = meteredFetch(model.provider, http, now);
  const inner = createGenerationClient({ ...model, apiKey, http: metered.http });
  const attempts: unknown[] = [];
  const client: GenerationClient = async (request) => {
    const raw = await inner(request);
    attempts.push(raw);
    return raw;
  };

  const startedAt = new Date().toISOString();
  const began = now();
  let outcome: RunOutcome;
  let error: string | null = null;
  let overview: RunRecord["overview"] = null;
  try {
    overview = await generateOverview(client, { ...comparisonInput(fetched), ...profile }, {
      id: OverviewId.parse(randomUUID()),
      savedAt: startedAt,
    });
    outcome = attempts.length === 1 ? "passed-first" : "passed-after-retry";
  } catch (thrown) {
    outcome = isTheModelsDoing(thrown) ? "failed" : "errored";
    error = thrown instanceof Error ? `${thrown.name}: ${thrown.message}` : String(thrown);
  }

  return {
    videoId: fetched.video.id ?? fetched.video.url,
    provider: model.provider,
    model: model.model,
    startedAt,
    outcome,
    error,
    calls: metered.calls,
    latencyMs: Math.round(now() - began),
    costDollars: measuredCost(model, metered.calls),
    attempts,
    overview,
  };
}
