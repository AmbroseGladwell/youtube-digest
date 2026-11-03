import { z } from "zod";
import type { ForAnyoneInput } from "@overview/domain";
import { WRITING_RULES } from "./composePrompt.js";
import type { GenerationClient } from "./generateOverview.js";
import { GenerationError } from "./GenerationError.js";
import { howToApplyInstructions, howToApplyShape } from "./sections/howToApplySection.js";

const ForAnyoneOutput = z.object(howToApplyShape());

// The same section the note was written with, for no reader in particular, so the two sides of
// the reveal's flip differ only in who they're for (docs/features/personalisation.md).
export async function generateForAnyoneSteps(client: GenerationClient, input: ForAnyoneInput): Promise<string[]> {
  const raw = await client({
    systemPrompt: `You write the How to apply section for a saved note, for any reader. ${WRITING_RULES}${howToApplyInstructions(null)}`,
    userMessage: [
      `Title: ${input.title}`,
      `Channel: ${input.channel}`,
      `In one line: ${input.inOneLine}`,
      `Core claim: ${input.coreClaim}`,
      "Key points:",
      ...input.keyPoints.map((point) => `- ${point}`),
    ].join("\n"),
    schema: ForAnyoneOutput,
  });
  const parsed = ForAnyoneOutput.safeParse(raw);
  if (!parsed.success) {
    throw new GenerationError(`How to apply for anyone failed its schema: ${parsed.error.message}`);
  }
  return parsed.data.items;
}
