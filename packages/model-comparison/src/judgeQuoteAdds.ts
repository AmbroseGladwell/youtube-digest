import { z } from "zod";
import type { Overview, Provider } from "@overview/domain";
import { createGenerationClient, meteredFetch, type MeteredCall } from "@overview/generation";
import { comparedModelName, type ComparedModel } from "./ComparedModel.js";
import { actionJudgeFor } from "./judgeActions.js";
import type { JudgeOutcome } from "./JudgeRecord.js";
import { isTheModelsDoing, measuredCost } from "./runOne.js";

export const QuoteAddsVerdict = z.enum(["adds", "restates", "whyItMatters"]);
export type QuoteAddsVerdict = z.infer<typeof QuoteAddsVerdict>;

export const QuoteAddsLabels = z.object({
  lines: z.array(z.object({ reason: z.string(), verdict: QuoteAddsVerdict })),
});
export type QuoteAddsLabels = z.infer<typeof QuoteAddsLabels>;

export interface QuoteAddsJudgeRecord {
  videoId: string;
  writer: string;
  judge: string;
  judgedAt: string;
  outcome: JudgeOutcome;
  error: string | null;
  quoted: number;
  labels: QuoteAddsLabels | null;
  calls: MeteredCall[];
  latencyMs: number;
  costDollars: number | null;
}

// The owner's gate for the line beside a quotation, 8 Nov 2026: "why it matters, only if it
// adds value to the key point to help understanding" (docs/features/overview-generation-decisions.md,
// "Evidence"). A high restates rate means the prompt's distinction isn't landing.
const SYSTEM_PROMPT = `You check short lines in a note about a video or article. Each key point below is our
summary of something the source said, followed by the source's own words quoted beneath it, and
then one line on what that quotation adds.

That line has one job: to say what the speaker's own words add that the key point does not, such as
that they hedged, contradicted themselves, put it more bluntly than a summary would, or that the
exact phrasing is what makes the claim land.

For each line, in order, give a one-sentence reason first, then one verdict:
- adds: it tells the reader something about the quotation that the key point does not already say.
- restates: it repeats or paraphrases the key point or the quotation, adding nothing.
- whyItMatters: it explains why the subject is important or how to use it, rather than what the
  quotation adds. That is another section's job.`;

export const quotedLinesOf = (overview: Overview) =>
  overview.keyPoints.flatMap((point) =>
    point.evidence?.adds ? [{ point: point.text, quotation: point.evidence.text, adds: point.evidence.adds }] : [],
  );

export function quoteAddsJudgePrompt(lines: ReturnType<typeof quotedLinesOf>) {
  return {
    systemPrompt: SYSTEM_PROMPT,
    userMessage: lines
      .map(({ point, quotation, adds }, index) => `${index + 1}. Key point: ${point}\nQuotation: “${quotation}”\nWhat it adds: ${adds}`)
      .join("\n\n"),
    schema: QuoteAddsLabels,
  };
}

export interface JudgeQuoteAddsOptions {
  videoId: string;
  overview: Overview;
  writer: ComparedModel;
  keys: Partial<Record<Provider, string>>;
  http?: typeof fetch;
  now?: () => number;
}

// A judge from another provider than the writer, as for the actions (docs/architecture/model-comparison.md).
export async function judgeQuoteAdds({
  videoId,
  overview,
  writer,
  keys,
  http = globalThis.fetch.bind(globalThis),
  now = () => performance.now(),
}: JudgeQuoteAddsOptions): Promise<QuoteAddsJudgeRecord> {
  const judge = actionJudgeFor(writer, null);
  const metered = meteredFetch(judge.provider, http, now);
  const client = createGenerationClient({ ...judge, apiKey: keys[judge.provider] ?? "", http: metered.http });
  const lines = quotedLinesOf(overview);

  const began = now();
  let outcome: JudgeOutcome = "judged";
  let error: string | null = null;
  let labels: QuoteAddsLabels | null = null;
  try {
    const parsed = QuoteAddsLabels.safeParse(await client(quoteAddsJudgePrompt(lines)));
    if (!parsed.success) throw new Error(`the judge's answer broke its schema: ${parsed.error.message}`);
    if (parsed.data.lines.length !== lines.length)
      throw new Error(`the judge's answer gave ${parsed.data.lines.length} verdicts for ${lines.length} lines`);
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
    quoted: overview.keyPoints.filter((point) => point.evidence !== undefined).length,
    labels,
    calls: metered.calls,
    latencyMs: Math.round(now() - began),
    costDollars: measuredCost(judge, metered.calls),
  };
}
