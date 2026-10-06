import { z } from "zod";
import { resolveTags, type Overview, type TagAliases, type TagCount } from "@overview/domain";
import type { GenerationClient } from "./generateOverview.js";
import { GenerationError } from "./GenerationError.js";
import { GeneratedTags, tagInstructions } from "./sections/filingSection.js";

export interface TagsInput {
  overview: Overview;
  existingTags: TagCount[];
  tagAliases: TagAliases;
}

const TagsOutput = z.object({ tags: GeneratedTags });

// Tags for a note that already exists, from the note rather than the transcript: the one-off
// re-tag of a library made before tags were reused (docs/features/tag-reuse.md).
export async function generateTags(client: GenerationClient, input: TagsInput): Promise<string[]> {
  const { overview } = input;
  const raw = await client({
    systemPrompt: `You tag a saved overview of a YouTube video for its reader.\n\n${tagInstructions(input.existingTags)}`,
    userMessage: [
      `Title: ${overview.video.title}`,
      `Channel: ${overview.video.channel}`,
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
}
