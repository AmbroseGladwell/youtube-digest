import { z } from "zod";
import {
  learnedItemKey,
  MAX_ITEMS_FROM_A_PASS,
  MAX_LEARNED_ITEM_LENGTH,
  MIN_OVERVIEWS_BEHIND_AN_ITEM,
  type ProfilePassInput,
  type ProfilePassItem,
} from "@overview/domain";
import type { GenerationClient } from "./generateOverview.js";
import { GenerationError } from "./GenerationError.js";

const ProfileOutput = z.object({
  items: z
    .array(
      z.object({
        text: z.string().min(1).max(MAX_LEARNED_ITEM_LENGTH),
        overviewIndices: z.array(z.int().min(0)),
      }),
    )
    .max(MAX_ITEMS_FROM_A_PASS),
});

const SYSTEM_PROMPT = `You keep a short profile of a reader, from what they choose to save. It is used only to make practical steps fit their life.

Say what you can fairly conclude that the reader is doing, learning or working towards: a few lowercase words that finish "I'm...", such as "building a consumer app" or "training for strength".

- Only what several of the overviews show together. One overview is curiosity, not a pattern. If nothing stands out, return no items.
- Never guess at health, money troubles, relationships, religion, politics or anything else a reader wouldn't want assumed.
- Nothing the profile already says.
- Nothing from the removed list, or anything close to it. The reader has said those are wrong.
- List the indices of the overviews each item rests on.`;

const listed = (items: readonly string[]) => (items.length === 0 ? "none" : items.map((item) => `- ${item}`).join("\n"));

function sourceOf(indices: readonly number[], overviews: ProfilePassInput["overviews"]): string {
  const tally = new Map<string, number>();
  for (const index of indices) {
    for (const topic of overviews[index]?.topics ?? []) tally.set(topic, (tally.get(topic) ?? 0) + 1);
  }
  const topic = [...tally.entries()].sort(([, a], [, b]) => b - a)[0]?.[0];
  return topic === undefined ? `From ${indices.length} overviews` : `From ${indices.length} overviews on ${topic.toLowerCase()}`;
}

// The model says what and which overviews; code counts them, drops what can't stand and writes
// the source line (docs/prototype/constraints.md, docs/features/personalisation.md).
export async function generateProfileItems(client: GenerationClient, input: ProfilePassInput): Promise<ProfilePassItem[]> {
  const raw = await client({
    systemPrompt: SYSTEM_PROMPT,
    userMessage: [
      `What the reader says about themselves: ${input.sentence ?? "nothing yet"}`,
      `Already in the profile:\n${listed(input.learned)}`,
      `Removed by the reader:\n${listed(input.removed)}`,
      "Recent overviews, by index:",
      ...input.overviews.map(
        ({ title, premise, topics, captureReason }, index) =>
          `${index}. ${title}: ${premise} (topics: ${topics.join(", ") || "none"}; why they saved it: ${captureReason ?? "not said"})`,
      ),
    ].join("\n\n"),
    schema: ProfileOutput,
  });
  const parsed = ProfileOutput.safeParse(raw);
  if (!parsed.success) {
    throw new GenerationError(`profile items failed their schema: ${parsed.error.message}`);
  }
  const held = new Set([...input.learned, ...input.removed].map(learnedItemKey));
  return parsed.data.items.flatMap(({ text, overviewIndices }) => {
    const indices = [...new Set(overviewIndices)].filter((index) => index < input.overviews.length);
    if (indices.length < MIN_OVERVIEWS_BEHIND_AN_ITEM || held.has(learnedItemKey(text))) return [];
    held.add(learnedItemKey(text));
    return [{ text: text.trim(), source: sourceOf(indices, input.overviews) }];
  });
}
