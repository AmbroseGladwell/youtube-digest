import { z } from "zod";
import { GeneratedTags, SuggestedTopicShape, TAG_VOCABULARY_CAP } from "../../sections/filingSection.js";
import type { ArticlePromptSection } from "../ArticlePromptSection.js";

export const articleFilingSection: ArticlePromptSection = {
  key: "structural",
  prompt: (input) => {
    const topicList =
      input.existingTopics.length === 0
        ? "The reader has no topics yet."
        : input.existingTopics.map((topic) => `- "${topic.name}"${topic.description ? `: ${topic.description}` : ""}`).join("\n");
    const vocabulary = input.existingTags.slice(0, TAG_VOCABULARY_CAP).map(({ tag }) => tag);
    const tagList =
      vocabulary.length === 0 ? "The reader has no tags yet." : `The reader's existing tags, most used first:\n${vocabulary.join(", ")}`;
    return `
## Topic
Here is the reader's own list of topics:
${topicList}

Say which of them this article matches, zero or more. This is matching
against a reader-owned list, not classifying into a fixed taxonomy. An
empty match set is a normal, honest outcome, not a failure. If the match
set is empty or doesn't fully cover what the article is about, you may
additionally suggest one new topic name (plus a short description) for
the reader to create. Never invent a topic and file the article under it
yourself.

## Tags
3 to 6 lowercase, hyphenated tags naming what the article is about, so the
reader can find the other overviews on the same subject.
${tagList}

Reuse an existing tag wherever one fits, spelled exactly as it is listed,
even if you would have worded it differently. Add a new tag only when no
existing one covers that subject.`;
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
