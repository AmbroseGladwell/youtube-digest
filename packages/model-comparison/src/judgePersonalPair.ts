import { z } from "zod";
import type { Overview, Provider } from "@overview/domain";
import { createGenerationClient, meteredFetch, type MeteredCall } from "@overview/generation";
import type { FetchedTranscript } from "@overview/transcripts";
import { comparedModelName, parseComparedModel } from "./ComparedModel.js";
import { candidateGoesFirst } from "./judgePair.js";
import { noteForJudging } from "./judgeRubric.js";
import { sharedPartOf } from "./personalisePrompt.js";
import type { ReaderProfile } from "./ReaderProfile.js";
import { isTheModelsDoing, measuredCost } from "./runOne.js";
import type { CandidateResult, JudgeOutcome } from "./JudgeRecord.js";
import type { RunRecord } from "./RunRecord.js";

export const PERSONAL_JUDGE = "openai:gpt-6.1-sol";

export const PERSONAL_DIMENSIONS = ["howToApply", "filing", "similarClaims"] as const;
export type PersonalDimension = (typeof PERSONAL_DIMENSIONS)[number];

const Call = z.object({ reason: z.string(), winner: z.enum(["A", "B", "tie"]) });

export const PersonalJudgeAnswer = z.object({
  howToApply: Call,
  filing: Call,
  similarClaims: Call,
  overall: Call,
});
export type PersonalJudgeAnswer = z.infer<typeof PersonalJudgeAnswer>;

export interface PersonalJudgeRecord {
  videoId: string;
  baseline: string;
  candidate: string;
  judge: string;
  candidateIsA: boolean;
  judgedAt: string;
  outcome: JudgeOutcome;
  error: string | null;
  answer: PersonalJudgeAnswer | null;
  results: Record<PersonalDimension | "overall", CandidateResult> | null;
  calls: MeteredCall[];
  latencyMs: number;
  costDollars: number | null;
}

const SYSTEM_PROMPT = `You compare two personalisations of the same note about a YouTube video, written for one
reader. The shared note says what the video claims and whether it holds up; it is the same for
both and is not being judged. You are given the shared note, what is known about the reader,
and two sets of personal parts, A and B. Which came first means nothing.

Judge each dimension on its own, then overall:

- howToApply: one to three things this reader could actually do, specific and concrete, and
  fitted to this reader. A step, schedule or number the video doesn't give is fine when it
  sensibly applies what the video teaches. A step that misrepresents or contradicts what the
  video teaches is not. An empty list is right when nothing in the video is actionable.
- filing: the matched topics are the reader's topics this video belongs under, and no others.
  A suggested new topic appears only when no existing one fits. Tags name what the video is about
  and reuse the reader's existing tags wherever one fits.
- similarClaims: the past claims listed are ones this video actually repeats, and none it
  doesn't. An empty list is right when nothing repeats.

Answer "tie" for a dimension when neither is meaningfully better. For overall, pick the set the
reader would rather have. Give the reason in one sentence before each winner.`;

const lastAttemptOf = (record: RunRecord): Record<string, unknown> =>
  (record.attempts.at(-1) ?? {}) as Record<string, unknown>;

export function personalPartsText(record: RunRecord, profile: ReaderProfile): string {
  const overview = record.overview!;
  const topicNames = profile.existingTopics
    .filter((topic) => overview.topicIds.includes(topic.id))
    .map((topic) => topic.name);
  const suggested = lastAttemptOf(record).suggestedTopic as { name: string; description: string | null } | null;
  const items = overview.howToApply?.items ?? [];
  return [
    "How to apply:",
    ...(items.length === 0 ? ["(nothing)"] : items.map((item) => `- ${item}`)),
    `Matched topics: ${topicNames.length === 0 ? "none" : topicNames.join(", ")}`,
    `Suggested new topic: ${suggested ? `${suggested.name}${suggested.description ? `: ${suggested.description}` : ""}` : "none"}`,
    `Tags: ${overview.tags.join(", ")}`,
    `Repeats past claims: ${
      (overview.verdict?.similarTo ?? []).map((similar) => similar.title).join("; ") || "none"
    }`,
  ].join("\n");
}

export function personalJudgePrompt(shared: Overview, profile: ReaderProfile, partsA: string, partsB: string) {
  return {
    systemPrompt: SYSTEM_PROMPT,
    userMessage: `About the reader: ${profile.readerContext ?? "nothing said"}
The reader's topics: ${profile.existingTopics.map((topic) => topic.name).join(", ") || "none"}
The reader's existing tags: ${profile.existingTags.map(({ tag }) => tag).join(", ") || "none"}
The reader's past claims:
${profile.pastClaims.map((claim) => `- ${claim.title}: ${claim.claim}`).join("\n") || "none"}

=== The shared note ===
${noteForJudging(sharedPartOf(shared))}

=== Personal parts A ===
${partsA}

=== Personal parts B ===
${partsB}`,
    schema: PersonalJudgeAnswer,
  };
}

const asCandidate = (winner: "A" | "B" | "tie", candidateIsA: boolean): CandidateResult =>
  winner === "tie" ? "tie" : (winner === "A") === candidateIsA ? "win" : "loss";

export interface JudgePersonalPairOptions {
  fetched: FetchedTranscript;
  profile: ReaderProfile;
  baseline: { name: string; record: RunRecord };
  candidate: { name: string; record: RunRecord };
  keys: Partial<Record<Provider, string>>;
  http?: typeof fetch;
  now?: () => number;
}

export async function judgePersonalPair({
  fetched,
  profile,
  baseline,
  candidate,
  keys,
  http = globalThis.fetch.bind(globalThis),
  now = () => performance.now(),
}: JudgePersonalPairOptions): Promise<PersonalJudgeRecord> {
  const videoId = fetched.video.id ?? fetched.video.url;
  const judge = parseComparedModel(PERSONAL_JUDGE);
  const candidateIsA = candidateGoesFirst(videoId, candidate.name);
  const baselineParts = personalPartsText(baseline.record, profile);
  const candidateParts = personalPartsText(candidate.record, profile);
  const [partsA, partsB] = candidateIsA ? [candidateParts, baselineParts] : [baselineParts, candidateParts];

  const metered = meteredFetch(judge.provider, http, now);
  const client = createGenerationClient({ ...judge, apiKey: keys[judge.provider] ?? "", http: metered.http });

  const began = now();
  let outcome: JudgeOutcome = "judged";
  let error: string | null = null;
  let answer: PersonalJudgeAnswer | null = null;
  try {
    const parsed = PersonalJudgeAnswer.safeParse(
      await client(personalJudgePrompt(baseline.record.overview!, profile, partsA, partsB)),
    );
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
            [...PERSONAL_DIMENSIONS, "overall" as const].map((dimension) => [
              dimension,
              asCandidate(answer![dimension].winner, candidateIsA),
            ]),
          ) as PersonalJudgeRecord["results"]),
    calls: metered.calls,
    latencyMs: Math.round(now() - began),
    costDollars: measuredCost(judge, metered.calls),
  };
}
