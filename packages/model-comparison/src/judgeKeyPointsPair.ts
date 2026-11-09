import { createGenerationClient, meteredFetch } from "@overview/generation";
import { comparedModelName, parseComparedModel } from "./ComparedModel.js";
import { judgeFor, type JudgePairOptions } from "./judgePair.js";
import type { CandidateResult, JudgeOutcome } from "./JudgeRecord.js";
import type { KeyPointsJudgeRecord, KeyPointsResults } from "./KeyPointsJudgeRecord.js";
import { KEY_POINT_DIMENSIONS, KeyPointsAnswer, keyPointsPrompt } from "./keyPointsRubric.js";
import { isTheModelsDoing, measuredCost } from "./runOne.js";

const asCandidate = (winner: "A" | "B" | "tie", candidateIsA: boolean): CandidateResult =>
  winner === "tie" ? "tie" : (winner === "A") === candidateIsA ? "win" : "loss";

// Judged once in each order. A side wins a dimension only when both orders agree, so a
// judge that leans towards whichever note it reads first scores a tie, not a win.
export function combineOrders(candidateFirst: KeyPointsAnswer, candidateSecond: KeyPointsAnswer): KeyPointsResults {
  return Object.fromEntries(
    [...KEY_POINT_DIMENSIONS, "overall" as const].map((dimension) => {
      const first = asCandidate(candidateFirst[dimension].winner, true);
      const second = asCandidate(candidateSecond[dimension].winner, false);
      return [dimension, first === second ? first : "tie"];
    }),
  ) as KeyPointsResults;
}

export async function judgeKeyPointsPair({
  fetched,
  baseline,
  candidate,
  keys,
  http = globalThis.fetch.bind(globalThis),
  now = () => performance.now(),
}: JudgePairOptions): Promise<KeyPointsJudgeRecord> {
  const judge = judgeFor(parseComparedModel(baseline.name), parseComparedModel(candidate.name));
  const metered = meteredFetch(judge.provider, http, now);
  const client = createGenerationClient({ ...judge, apiKey: keys[judge.provider] ?? "", http: metered.http });

  const began = now();
  let outcome: JudgeOutcome = "judged";
  let error: string | null = null;
  const ask = async (candidateIsA: boolean): Promise<KeyPointsAnswer | null> => {
    const [noteA, noteB] = candidateIsA ? [candidate.overview, baseline.overview] : [baseline.overview, candidate.overview];
    const parsed = KeyPointsAnswer.safeParse(await client(keyPointsPrompt(fetched, noteA, noteB)));
    if (parsed.success) return parsed.data;
    outcome = "failed";
    error = `the judge's answer broke its schema: ${parsed.error.message}`;
    return null;
  };

  let candidateFirst: KeyPointsAnswer | null = null;
  let candidateSecond: KeyPointsAnswer | null = null;
  try {
    [candidateFirst, candidateSecond] = await Promise.all([ask(true), ask(false)]);
  } catch (thrown) {
    outcome = isTheModelsDoing(thrown) ? "failed" : "errored";
    error = thrown instanceof Error ? `${thrown.name}: ${thrown.message}` : String(thrown);
  }

  return {
    videoId: fetched.video.id ?? fetched.video.url,
    baseline: baseline.name,
    candidate: candidate.name,
    judge: comparedModelName(judge),
    judgedAt: new Date().toISOString(),
    outcome,
    error,
    candidateFirst,
    candidateSecond,
    results: candidateFirst !== null && candidateSecond !== null ? combineOrders(candidateFirst, candidateSecond) : null,
    calls: metered.calls,
    latencyMs: Math.round(now() - began),
    costDollars: measuredCost(judge, metered.calls),
  };
}
