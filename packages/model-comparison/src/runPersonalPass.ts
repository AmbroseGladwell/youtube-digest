import type { Overview } from "@overview/domain";
import { correctionRequest, createGenerationClient, meteredFetch } from "@overview/generation";
import type { FetchedTranscript } from "@overview/transcripts";
import type { ComparedModel } from "./ComparedModel.js";
import { personalisePrompt, personalisedOverview, type PersonalOutput } from "./personalisePrompt.js";
import type { ReaderProfile } from "./ReaderProfile.js";
import { isTheModelsDoing, measuredCost } from "./runOne.js";
import type { RunOutcome, RunRecord } from "./RunRecord.js";

export interface RunPersonalPassOptions {
  model: ComparedModel;
  apiKey: string;
  fetched: FetchedTranscript;
  profile: ReaderProfile;
  shared: Overview;
  withTranscript: boolean;
  http?: typeof fetch;
  now?: () => number;
}

export async function runPersonalPass({
  model,
  apiKey,
  fetched,
  profile,
  shared,
  withTranscript,
  http = globalThis.fetch.bind(globalThis),
  now = () => performance.now(),
}: RunPersonalPassOptions): Promise<RunRecord> {
  const metered = meteredFetch(model.provider, http, now);
  const client = createGenerationClient({ ...model, apiKey, http: metered.http });
  const { systemPrompt, userMessage, schema } = personalisePrompt(fetched, profile, shared, withTranscript);
  const attempts: unknown[] = [];

  const attempt = async (correction?: string) => {
    const raw = await client({
      systemPrompt,
      userMessage: correction ? `${userMessage}\n\n${correction}` : userMessage,
      schema,
    });
    attempts.push(raw);
    return { raw, parsed: schema.safeParse(raw) };
  };

  const startedAt = new Date().toISOString();
  const began = now();
  let outcome: RunOutcome;
  let error: string | null = null;
  let overview: Overview | null = null;
  try {
    let { raw, parsed } = await attempt();
    if (!parsed.success) ({ raw, parsed } = await attempt(correctionRequest(raw, parsed.error)));
    if (parsed.success) {
      overview = personalisedOverview(shared, profile, parsed.data as unknown as PersonalOutput);
      outcome = attempts.length === 1 ? "passed-first" : "passed-after-retry";
    } else {
      outcome = "failed";
      error = `the personal pass still failed its schema after a retry: ${parsed.error.message}`;
    }
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
