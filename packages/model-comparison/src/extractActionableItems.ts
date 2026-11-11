import { z } from "zod";
import type { Provider } from "@overview/domain";
import { createGenerationClient, meteredFetch, type MeteredCall } from "@overview/generation";
import { comparedModelName, type ComparedModel } from "./ComparedModel.js";
import type { JudgeOutcome } from "./JudgeRecord.js";
import { isTheModelsDoing, measuredCost } from "./runOne.js";
import type { StepsSource } from "./StepsSource.js";

export const ActionableItemKind = z.enum(["step", "instruction", "rule"]);

export const ExtractedItems = z.object({
  items: z.array(
    z.object({
      text: z.string(),
      kind: ActionableItemKind,
      start: z.int(),
      end: z.int(),
    }),
  ),
});
export type ExtractedItems = z.infer<typeof ExtractedItems>;
export type ActionableItem = ExtractedItems["items"][number];

export interface ActionableItemsRecord {
  sourceId: string;
  judge: string;
  extractedAt: string;
  outcome: JudgeOutcome;
  error: string | null;
  items: ActionableItem[] | null;
  calls: MeteredCall[];
  latencyMs: number;
  costDollars: number | null;
}

// What a reader would have to do, in the source's own terms, never what we would advise:
// How to apply is ours, and this list is the source's (OV-250, OV-251).
const SYSTEM_PROMPT = `You read the text of a video or article, given as numbered units, and list what it tells
the reader to do: every step of a process or protocol, every instruction, and every rule of
thumb the source gives for acting. List them in the source's order, each as one plain sentence in
the source's terms, keeping the quantities, times, conditions and the reason when the source
gives one, because those change what a reader would do. Mark each:

- step: one stage of a process or protocol the source walks through.
- instruction: a standalone thing the source tells the reader to do.
- rule: a rule of thumb for deciding or acting ("stop when it stops hurting"), including how
  to tell it is working or that you are on track, and a reassurance that changes what the reader
  does next ("if the soreness has faded by day three, you are on track; keep going").

For each, give start and end: the numbered units where the source says it.

Leave out anything that is not the source telling the reader to act on its subject: claims,
findings, stories, opinions, background, advice the source attributes to someone it disagrees
with, sponsor reads and adverts, and calls to like, subscribe, follow, buy, click or press
anything. Never add a
step the source does not give. A source that tells the reader to do nothing gives an empty list,
which is common and correct.`;

export function actionableItemsPrompt(source: StepsSource) {
  return {
    systemPrompt: SYSTEM_PROMPT,
    userMessage: `Title: ${source.title}\n\n${source.units.map((text, index) => `[${index}] ${text}`).join("\n")}`,
    schema: ExtractedItems,
  };
}

// An item whose place doesn't fit the source is kept without a place rather than guessed.
const placed =
  (source: StepsSource) =>
  (item: ActionableItem): ActionableItem =>
    item.start >= 0 && item.start <= item.end && item.end < source.units.length ? item : { ...item, start: -1, end: -1 };

export interface ExtractActionableItemsOptions {
  source: StepsSource;
  judge: ComparedModel;
  keys: Partial<Record<Provider, string>>;
  http?: typeof fetch;
  now?: () => number;
}

export async function extractActionableItems({
  source,
  judge,
  keys,
  http = globalThis.fetch.bind(globalThis),
  now = () => performance.now(),
}: ExtractActionableItemsOptions): Promise<ActionableItemsRecord> {
  const metered = meteredFetch(judge.provider, http, now);
  const client = createGenerationClient({ ...judge, apiKey: keys[judge.provider] ?? "", http: metered.http });
  const began = now();
  let outcome: JudgeOutcome = "judged";
  let error: string | null = null;
  let items: ActionableItem[] | null = null;
  try {
    const parsed = ExtractedItems.safeParse(await client(actionableItemsPrompt(source)));
    if (!parsed.success) throw new Error(`the judge's answer broke its schema: ${parsed.error.message}`);
    items = parsed.data.items.map(placed(source));
  } catch (thrown) {
    outcome =
      isTheModelsDoing(thrown) || (thrown instanceof Error && thrown.message.startsWith("the judge's answer")) ? "failed" : "errored";
    error = thrown instanceof Error ? `${thrown.name}: ${thrown.message}` : String(thrown);
  }
  return {
    sourceId: source.sourceId,
    judge: comparedModelName(judge),
    extractedAt: new Date().toISOString(),
    outcome,
    error,
    items,
    calls: metered.calls,
    latencyMs: Math.round(now() - began),
    costDollars: measuredCost(judge, metered.calls),
  };
}
