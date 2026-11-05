import { z } from "zod";
import type { TopicMatchInput } from "@overview/domain";
import type { GenerationClient } from "./generateOverview.js";
import { GenerationError } from "./GenerationError.js";

// Which of the reader's own topics a finished note belongs under, zero or more, matched against
// their list and never added to: the same rule the note's own filing follows
// (docs/features/topic-filing.md), for a note made for someone else.
export async function generateTopicMatches(client: GenerationClient, input: TopicMatchInput): Promise<string[]> {
  const names = input.topics.map((topic) => topic.name) as [string, ...string[]];
  const TopicMatchOutput = z.object({ matchedTopicNames: z.array(z.enum(names)) });
  const raw = await client({
    systemPrompt: `You sort a saved overview into its reader's own topics.

Here is the reader's own list of topics:
${input.topics.map((topic) => `- "${topic.name}"${topic.description ? `: ${topic.description}` : ""}`).join("\n")}

Say which of them this overview matches, zero or more. This is matching against a reader-owned
list, not classifying into a fixed taxonomy: an empty match set is a normal, honest outcome, not a
failure. Never name a topic that isn't on the list.`,
    userMessage: [
      `Title: ${input.title}`,
      `From: ${input.source}`,
      `In one line: ${input.inOneLine}`,
      ...(input.keyPoints.length === 0 ? [] : ["Key points:", ...input.keyPoints.map((point) => `- ${point}`)]),
    ].join("\n"),
    schema: TopicMatchOutput,
  });
  const parsed = TopicMatchOutput.safeParse(raw);
  if (!parsed.success) {
    throw new GenerationError(`topic matches failed their schema: ${parsed.error.message}`);
  }
  return [...new Set(parsed.data.matchedTopicNames)];
}
