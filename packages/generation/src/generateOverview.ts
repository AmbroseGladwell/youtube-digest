import type { OverviewId } from "@digest/types";
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
  const raw = await client({ systemPrompt, userMessage, schema });

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new GenerationError(`generated output failed its own schema: ${parsed.error.message}`);
  }

  return assembleOverview(input, parsed.data as unknown as GeneratedOutput, meta);
}
