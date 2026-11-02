import type { Overview, OverviewId } from "@overview/domain";
import type { z } from "zod";
import type { GenerationInput } from "./GenerationInput.js";
import type { GeneratedOutput } from "./GeneratedOutput.js";
import { composePrompt, type ComposedPrompt } from "./composePrompt.js";
import { assembleOverview } from "./assembleOverview.js";
import { SchemaFailureError } from "./GenerationError.js";

export type GenerationClient = (request: {
  systemPrompt: string;
  userMessage: string;
  schema: z.ZodObject<z.ZodRawShape>;
}) => Promise<unknown>;

export function correctionRequest(previous: unknown, error: z.ZodError): string {
  const violations = error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
  return [
    "Your previous attempt was:",
    JSON.stringify(previous),
    "",
    `It violated: ${violations}.`,
    "Send that same response again, corrected, changing only what those violations need.",
    "A list with too many items keeps the ones that matter most and drops the rest.",
    "A field with too many words keeps its meaning and drops words.",
  ].join("\n");
}

// Asks once, and once more with what was wrong, before giving up.
export async function requestGeneratedOutput<Output>(client: GenerationClient, prompt: ComposedPrompt): Promise<Output> {
  const { systemPrompt, userMessage, schema } = prompt;

  const attempt = async (correction?: string) => {
    const raw = await client({
      systemPrompt,
      userMessage: correction ? `${userMessage}\n\n${correction}` : userMessage,
      schema,
    });
    return { raw, parsed: schema.safeParse(raw) };
  };

  let { raw, parsed } = await attempt();
  if (!parsed.success) {
    ({ raw, parsed } = await attempt(correctionRequest(raw, parsed.error)));
  }

  if (!parsed.success) {
    throw new SchemaFailureError(
      `generated output still failed its own schema after a retry: ${parsed.error.message}`,
    );
  }

  return parsed.data as unknown as Output;
}

export async function generateOverview(
  client: GenerationClient,
  input: GenerationInput,
  meta: { id: OverviewId; savedAt: string },
): Promise<Overview> {
  return assembleOverview(input, await requestGeneratedOutput<GeneratedOutput>(client, composePrompt(input)), meta);
}
