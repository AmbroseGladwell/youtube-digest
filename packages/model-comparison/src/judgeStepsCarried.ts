import { z } from "zod";
import type { Overview, Provider } from "@overview/domain";
import { createGenerationClient, meteredFetch, type MeteredCall } from "@overview/generation";
import { comparedModelName, type ComparedModel } from "./ComparedModel.js";
import type { ActionableItem } from "./extractActionableItems.js";
import type { JudgeOutcome } from "./JudgeRecord.js";
import { isTheModelsDoing, measuredCost } from "./runOne.js";

export const CarriedVerdict = z.enum(["carried", "partly", "missing"]);
export type CarriedVerdict = z.infer<typeof CarriedVerdict>;

export const CarriedLabels = z.object({
  items: z.array(z.object({ reason: z.string(), verdict: CarriedVerdict })),
});
export type CarriedLabels = z.infer<typeof CarriedLabels>;

export interface StepsJudgeRecord {
  videoId: string;
  writer: string;
  judge: string;
  judgedAt: string;
  outcome: JudgeOutcome;
  error: string | null;
  labels: CarriedLabels | null;
  calls: MeteredCall[];
  latencyMs: number;
  costDollars: number | null;
}

// "Partly" is narrow on purpose (owner, 11 Nov 2026): the note has the action but drops a
// condition, a quantity or the reason that would change what a reader does. Missing is the
// headline the report leads with.
const SYSTEM_PROMPT = `You check whether a note about a video or article carries what the source tells the
reader to do. You get the note, then a numbered list of the source's actionable items.

For each item, in order, give a reason of a few words first ("says to train legs", "never says
when to stop"), then one verdict:
- carried: a reader of the note alone would do this the way the source means, wherever in the
  note it appears. A dropped explanation of why it works, a mechanism, or an exact figure the
  reader would not act on differently does not stop it being carried.
- partly: the note has the action but drops something that would make a reader do it wrongly or
  at the wrong time: the condition for when to do it, an amount or duration they would get
  wrong, or a limit they would overstep.
- missing: a reader of the note alone would not know to do this. A chapter title that only names
  the topic ("why finishing fast is fine") does not carry the item.

Judge only what the note says. Do not credit what a reader might infer or already know.`;

// Everything the note shows a reader that could carry an action. The watch-anyway reason is
// left out: it is the claim being checked, not part of what it claims to cover.
export function noteText(overview: Overview): string {
  const section = (heading: string, lines: readonly string[]) =>
    lines.length === 0 ? [] : [`## ${heading}`, ...lines.map((line) => `- ${line}`)];
  return [
    ...section("Core claim", overview.coreClaim ? [overview.coreClaim] : []),
    ...section("Big picture", overview.bigPicture ? [overview.bigPicture] : []),
    ...section("What stands out", overview.verdict?.standsOut ? [overview.verdict.standsOut.text] : []),
    ...section(
      "Key points",
      overview.keyPoints.map(({ text }) => text),
    ),
    ...section(
      "The steps it gives",
      (overview.sourceSteps?.items ?? []).map(({ text }) => text),
    ),
    ...section("How to apply", overview.howToApply?.items ?? []),
    ...section(
      "Chapters",
      (overview.chapters ?? []).map(({ title, summary }) => `${title}: ${summary}`),
    ),
  ].join("\n");
}

export function stepsCarriedPrompt(overview: Overview, items: readonly ActionableItem[]) {
  return {
    systemPrompt: SYSTEM_PROMPT,
    userMessage: `# The note\n\n${noteText(overview)}\n\n# The source's actionable items\n\n${items.map(({ text }, index) => `${index + 1}. ${text}`).join("\n")}`,
    schema: CarriedLabels,
  };
}

export interface JudgeStepsCarriedOptions {
  videoId: string;
  overview: Overview;
  items: readonly ActionableItem[];
  writer: ComparedModel;
  judge: ComparedModel;
  keys: Partial<Record<Provider, string>>;
  http?: typeof fetch;
  now?: () => number;
}

// The judge never reads a note its own provider wrote (docs/architecture/model-comparison.md).
export async function judgeStepsCarried({
  videoId,
  overview,
  items,
  writer,
  judge,
  keys,
  http = globalThis.fetch.bind(globalThis),
  now = () => performance.now(),
}: JudgeStepsCarriedOptions): Promise<StepsJudgeRecord> {
  if (judge.provider === writer.provider) throw new Error(`a judge from ${writer.provider} would be judging its own provider's note`);
  const metered = meteredFetch(judge.provider, http, now);
  const client = createGenerationClient({ ...judge, apiKey: keys[judge.provider] ?? "", http: metered.http });
  const began = now();
  let outcome: JudgeOutcome = "judged";
  let error: string | null = null;
  let labels: CarriedLabels | null = null;
  try {
    const parsed = CarriedLabels.safeParse(await client(stepsCarriedPrompt(overview, items)));
    if (!parsed.success) throw new Error(`the judge's answer broke its schema: ${parsed.error.message}`);
    if (parsed.data.items.length !== items.length)
      throw new Error(`the judge's answer gave ${parsed.data.items.length} verdicts for ${items.length} items`);
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
