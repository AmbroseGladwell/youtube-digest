import type { OverviewId } from "@overview/types";
import type { z } from "zod";
import type { GenerationInput } from "./GenerationInput.js";
import type { GeneratedOutput } from "./GeneratedOutput.js";
import { composePrompt } from "./composePrompt.js";
import { assembleOverview, type AssembledOverview } from "./assembleOverview.js";
import { GenerationError } from "./GenerationError.js";

export type GenerationClient = (request: {
  systemPrompt: string;
  userMessage: string;
  schema: z.ZodObject<z.ZodRawShape>;
}) => Promise<unknown>;

export async function generateOverview(
  client: GenerationClient,
  input: GenerationInput,
  meta: { id: OverviewId; savedAt: string },
): Promise<AssembledOverview> {
  const { systemPrompt, userMessage, schema } = composePrompt(input);

  const attempt = async (retryNote?: string) => {
    const raw = await client({
      systemPrompt,
      userMessage: retryNote ? `${userMessage}\n\n${retryNote}` : userMessage,
      schema,
    });
    return schema.safeParse(raw);
  };

  let result = await attempt();
  if (!result.success) {
    const violations = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    result = await attempt(
      `Your previous attempt violated: ${violations}. Send a corrected response that fixes only that.`,
    );
  }

  if (!result.success) {
    throw new GenerationError(
      `generated output still failed its own schema after a retry: ${result.error.message}`,
    );
  }

  return assembleOverview(input, result.data as unknown as GeneratedOutput, meta);
}
