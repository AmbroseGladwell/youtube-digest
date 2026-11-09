import { z } from "zod";
import type { Overview, Provider } from "@overview/domain";
import { createGenerationClient, meteredFetch, type MeteredCall } from "@overview/generation";
import { comparedModelName, type ComparedModel } from "./ComparedModel.js";
import { actionJudgeFor } from "./judgeActions.js";
import type { JudgeOutcome } from "./JudgeRecord.js";
import { isTheModelsDoing, measuredCost } from "./runOne.js";

export const BigPictureLabels = z.object({
  reason: z.string(),
  deletion: z.enum(["loses-something", "loses-nothing"]),
  namesTheQuestion: z.boolean(),
  namesAnotherThread: z.boolean(),
  describesTheSource: z.boolean(),
});
export type BigPictureLabels = z.infer<typeof BigPictureLabels>;

export interface BigPictureJudgeRecord {
  videoId: string;
  writer: string;
  judge: string;
  judgedAt: string;
  outcome: JudgeOutcome;
  error: string | null;
  labels: BigPictureLabels | null;
  calls: MeteredCall[];
  latencyMs: number;
  costDollars: number | null;
}

const SYSTEM_PROMPT = `You check one field of a note written about a video or article. The note opens with three
short fields, each with its own job:

- In one line: what the source IS, its format and territory.
- Big picture: the ground the argument stands on: what question the source engages, why that
  question matters, and anything else substantial it covers that the core claim cannot hold.
- Core claim: the single thing it answers or asserts.

Your job is the deletion test on the big picture. Imagine deleting it. If a reader of In one
line and the core claim would lose nothing, the big picture has failed: answer "loses-nothing".
If deleting it would lose a question, a reason it matters, or a thread the other two never
mention, answer "loses-something". Rewording what the other two already say is not something.

Then, giving a one-sentence reason first:
- namesTheQuestion: does it name the question being engaged, or why that question matters?
- namesAnotherThread: does it name a substantial subject that neither of the other two fields covers?
- describesTheSource: does it describe the source itself, such as its format, speakers, host or length,
  rather than the subject? That is In one line's job, so true is a fault.`;

export function bigPictureJudgePrompt(overview: Pick<Overview, "inOneLine" | "bigPicture" | "coreClaim">) {
  return {
    systemPrompt: SYSTEM_PROMPT,
    userMessage: [
      `In one line: ${overview.inOneLine}`,
      `Big picture: ${overview.bigPicture ?? ""}`,
      `Core claim: ${overview.coreClaim}`,
    ].join("\n\n"),
    schema: BigPictureLabels,
  };
}

export interface JudgeBigPictureOptions {
  videoId: string;
  overview: Overview;
  writer: ComparedModel;
  judge?: ComparedModel | null;
  keys: Partial<Record<Provider, string>>;
  http?: typeof fetch;
  now?: () => number;
}

// A judge from another provider than the writer, as for the actions (docs/architecture/model-comparison.md).
export async function judgeBigPicture({
  videoId,
  overview,
  writer,
  judge: chosen = null,
  keys,
  http = globalThis.fetch.bind(globalThis),
  now = () => performance.now(),
}: JudgeBigPictureOptions): Promise<BigPictureJudgeRecord> {
  const judge = actionJudgeFor(writer, chosen);
  const metered = meteredFetch(judge.provider, http, now);
  const client = createGenerationClient({ ...judge, apiKey: keys[judge.provider] ?? "", http: metered.http });

  const began = now();
  let outcome: JudgeOutcome = "judged";
  let error: string | null = null;
  let labels: BigPictureLabels | null = null;
  try {
    const parsed = BigPictureLabels.safeParse(await client(bigPictureJudgePrompt(overview)));
    if (!parsed.success) throw new Error(`the judge's answer broke its schema: ${parsed.error.message}`);
    labels = parsed.data;
  } catch (thrown) {
    outcome =
      isTheModelsDoing(thrown) || (thrown instanceof Error && thrown.message.startsWith("the judge's answer")) ? "failed" : "errored";
    error = thrown instanceof Error ? `${thrown.name}: ${thrown.message}` : String(thrown);
  }

  return {
    videoId,
    writer: comparedModelName(writer),
    judge: comparedModelName(judge),
    judgedAt: new Date().toISOString(),
    outcome,
    error,
    labels,
    calls: metered.calls,
    latencyMs: Math.round(now() - began),
    costDollars: measuredCost(judge, metered.calls),
  };
}
