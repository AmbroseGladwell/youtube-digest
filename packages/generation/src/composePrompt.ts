import { z } from "zod";
import type { GenerationInput } from "./GenerationInput.js";
import { enabledSections } from "./sectionRegistry.js";

function contextBlock(input: GenerationInput): string {
  const transcript = input.transcript
    .map((segment, i) => `[${i}] ${segment.text}`)
    .join("\n");
  return `
Title: ${input.video.title}
Channel: ${input.video.channel}
Description: ${input.video.description ?? "unavailable"}
Why they saved it: ${input.captureReason ?? "not said"}

Transcript, as numbered segments:
${transcript}`;
}

export interface ComposedPrompt {
  systemPrompt: string;
  userMessage: string;
  schema: z.ZodObject<z.ZodRawShape>;
}

export function composePrompt(input: GenerationInput): ComposedPrompt {
  const sections = enabledSections(input);

  const instructions = sections.map((section) => section.prompt(input)).join("\n");

  const shape: Record<string, z.ZodType> = {};
  for (const section of sections) {
    const sectionShape = section.schemaShape(input);
    if (section.key === "structural") {
      Object.assign(shape, sectionShape);
    } else {
      shape[section.key] = z.object(sectionShape);
    }
  }

  return {
    systemPrompt:
      "You produce a blunt judgment record of a saved video for one reader, from its transcript alone. Follow the sections below exactly. " +
      "Never use an em dash (—) anywhere in your output; use a period, comma, or colon instead." +
      instructions,
    userMessage: contextBlock(input),
    schema: z.object(shape),
  };
}
