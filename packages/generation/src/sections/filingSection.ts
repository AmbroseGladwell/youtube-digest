import { z } from "zod";
import { MAX_TAGS, Tag, type TagCount } from "@overview/domain";
import type { PromptSection } from "../PromptSection.js";

export const SuggestedTopicShape = z.object({
  name: z.string(),
  description: z.string().nullable(),
});
export type SuggestedTopicShape = z.infer<typeof SuggestedTopicShape>;

// Every tag costs tokens on every overview, so only the most used are sent
// (docs/features/tag-reuse.md).
export const TAG_VOCABULARY_CAP = 60;

export const GeneratedTags = z.array(Tag).min(3).max(MAX_TAGS);

export function tagInstructions(existingTags: readonly TagCount[]): string {
  const vocabulary = existingTags.slice(0, TAG_VOCABULARY_CAP).map(({ tag }) => tag);
  const tagList =
    vocabulary.length === 0
      ? "The reader has no tags yet."
      : `The reader's existing tags, most used first:\n${vocabulary.join(", ")}`;
  return `## Tags
3 to 6 lowercase, hyphenated tags naming what the video is about, so the
reader can find the other overviews on the same subject.
${tagList}

Reuse an existing tag wherever one fits, spelled exactly as it is listed,
even if you would have worded it differently. Add a new tag only when no
existing one covers that subject.`;
}

export const filingSection: PromptSection = {
  title: "Filing",
  key: "structural",
  prompt: (input) => {
    const topicList =
      input.existingTopics.length === 0
        ? "The reader has no topics yet."
        : input.existingTopics
            .map((topic) => `- "${topic.name}"${topic.description ? `: ${topic.description}` : ""}`)
            .join("\n");
    return `
## Topic
Here is the reader's own list of topics:
${topicList}

Say which of them this video matches, zero or more — this is matching
against a reader-owned list, not classifying into a fixed taxonomy. An
empty match set is a normal, honest outcome, not a failure. If the match
set is empty or doesn't fully cover what the video is about, you may
additionally suggest one new topic name (plus a short description) for
the reader to create — never invent a topic and file the video under it
yourself.

${tagInstructions(input.existingTags)}`;
  },
  schemaShape: (input) => ({
    matchedTopicNames:
      input.existingTopics.length === 0
        ? z.array(z.string()).max(0)
        : z.array(z.enum(input.existingTopics.map((topic) => topic.name) as [string, ...string[]])),
    suggestedTopic: SuggestedTopicShape.nullable(),
    tags: GeneratedTags,
  }),
};
