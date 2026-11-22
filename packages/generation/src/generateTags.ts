import { sourceName, resolveTags, type Overview, type TagAliases, type TagCount } from "@overview/domain";
import { z } from "zod";
import type { GenerationClient } from "./requestGeneratedOutput.js";
import { GenerationError } from "./GenerationError.js";
import { GeneratedTags, tagInstructions } from "./sections/filingSection.js";

export interface TagsInput {
  overview: Overview;
  existingTags: TagCount[];
  tagAliases: TagAliases;
}

const TagsOutput = z.object({ tags: GeneratedTags });

// docs/features/tag-reuse.md, "Re-tagging the library that came before".
export const generateTags = async (client: GenerationClient, input: TagsInput): Promise<string[]> => {
  const { overview } = input;
  const raw = await client({
    systemPrompt: `You tag a saved overview of a YouTube video for its reader.\n\n${tagInstructions(input.existingTags)}`,
    userMessage: [
      `Title: ${overview.source.title}`,
      `From: ${sourceName(overview.source)}`,
      `In one line: ${overview.inOneLine}`,
      `Core claim: ${overview.coreClaim}`,
      "Key points:",
      ...overview.keyPoints.map((point) => `- ${point.text}`),
    ].join("\n"),
    schema: TagsOutput,
  });
  const parsed = TagsOutput.safeParse(raw);
  if (!parsed.success) {
    throw new GenerationError(`generated tags failed their schema: ${parsed.error.message}`);
  }
  return resolveTags(parsed.data.tags, {
    known: new Set(input.existingTags.map(({ tag }) => tag)),
    aliases: input.tagAliases,
  });
};
