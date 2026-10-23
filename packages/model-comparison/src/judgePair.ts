import { createHash } from "node:crypto";
import type { Overview, Provider } from "@overview/domain";
import { createGenerationClient, meteredFetch } from "@overview/generation";
import type { FetchedTranscript } from "@overview/transcripts";
import { comparedModelName, parseComparedModel, type ComparedModel } from "./ComparedModel.js";
import { isTheModelsDoing, measuredCost } from "./runOne.js";
import { JUDGE_DIMENSIONS, JudgeAnswer, judgePrompt } from "./judgeRubric.js";
import type { CandidateResult, JudgeOutcome, JudgeRecord } from "./JudgeRecord.js";

export const BASELINE_MODEL = "anthropic:claude-opus-5-5";

// docs/architecture/model-comparison.md, "Who judges": never a model from either note's
// provider, first choice first.
export const JUDGES: readonly string[] = ["openai:gpt-6.1-sol", "gemini:gemini-3.1-pro-preview", "anthropic:claude-opus-5-5"];

export function judgeFor(baseline: ComparedModel, candidate: ComparedModel): ComparedModel {
  const judge = JUDGES.map(parseComparedModel).find(
    (model) => model.provider !== baseline.provider && model.provider !== candidate.provider,
  );
  if (judge === undefined) throw new Error(`no judge outside ${baseline.provider} and ${candidate.provider}`);
  return judge;
}

export const candidateGoesFirst = (videoId: string, candidate: string): boolean =>
  (createHash("sha256").update(`${videoId}\n${candidate}`).digest()[0]! & 1) === 1;

const asCandidate = (winner: "A" | "B" | "tie", candidateIsA: boolean): CandidateResult =>
  winner === "tie" ? "tie" : (winner === "A") === candidateIsA ? "win" : "loss";

export interface JudgePairOptions {
  fetched: FetchedTranscript;
  baseline: { name: string; overview: Overview };
  candidate: { name: string; overview: Overview };
  keys: Partial<Record<Provider, string>>;
  http?: typeof fetch;
  now?: () => number;
}

export async function judgePair({
  fetched,
  baseline,
  candidate,
  keys,
  http = globalThis.fetch.bind(globalThis),
  now = () => performance.now(),
}: JudgePairOptions): Promise<JudgeRecord> {
  const videoId = fetched.video.id ?? fetched.video.url;
  const judge = judgeFor(parseComparedModel(baseline.name), parseComparedModel(candidate.name));
  const candidateIsA = candidateGoesFirst(videoId, candidate.name);
  const [noteA, noteB] = candidateIsA ? [candidate.overview, baseline.overview] : [baseline.overview, candidate.overview];

  const metered = meteredFetch(judge.provider, http, now);
  const client = createGenerationClient({ ...judge, apiKey: keys[judge.provider] ?? "", http: metered.http });

  const began = now();
  let outcome: JudgeOutcome = "judged";
  let error: string | null = null;
  let answer: JudgeAnswer | null = null;
  try {
    const parsed = JudgeAnswer.safeParse(await client(judgePrompt(fetched, noteA, noteB)));
    if (parsed.success) {
      answer = parsed.data;
    } else {
      outcome = "failed";
      error = `the judge's answer broke its schema: ${parsed.error.message}`;
    }
  } catch (thrown) {
    outcome = isTheModelsDoing(thrown) ? "failed" : "errored";
    error = thrown instanceof Error ? `${thrown.name}: ${thrown.message}` : String(thrown);
  }

  return {
    videoId,
    baseline: baseline.name,
    candidate: candidate.name,
    judge: comparedModelName(judge),
    candidateIsA,
    judgedAt: new Date().toISOString(),
    outcome,
    error,
    answer,
    results:
      answer === null
        ? null
        : (Object.fromEntries(
            [...JUDGE_DIMENSIONS, "overall" as const].map((dimension) => [
              dimension,
              asCandidate(answer![dimension].winner, candidateIsA),
            ]),
          ) as JudgeRecord["results"]),
    calls: metered.calls,
    latencyMs: Math.round(now() - began),
    costDollars: measuredCost(judge, metered.calls),
  };
}
