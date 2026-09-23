import { z } from "zod";
import { Filing } from "@overview/domain";
import type { PromptSection } from "../PromptSection.js";

export const SuggestedTopicShape = z.object({
  name: z.string(),
  description: z.string().nullable(),
});
export type SuggestedTopicShape = z.infer<typeof SuggestedTopicShape>;

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

## Tags
3 to 6 lowercase, hyphenated tags. A scanning aid, not a search mechanism
— the rest of the overview already carries anything a tag would add for
search.`;
  },
  schemaShape: (input) => ({
    matchedTopicNames:
      input.existingTopics.length === 0
        ? z.array(z.string()).max(0)
        : z.array(z.enum(input.existingTopics.map((topic) => topic.name) as [string, ...string[]])),
    suggestedTopic: SuggestedTopicShape.nullable(),
    tags: Filing.shape.tags,
  }),
};
