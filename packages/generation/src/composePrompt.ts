import { z } from "zod";
import type { GenerationInput } from "./GenerationInput.js";
import { enabledSections } from "./sectionRegistry.js";

const VIDEO_TAG = /<(\/?)(video|title|channel|description|transcript)\b/gi;

function asVideoContent(text: string): string {
  return text.replace(VIDEO_TAG, "‹$1$2");
}

function contextBlock(input: GenerationInput): string {
  const transcript = input.transcript
    .map((segment, i) => `[${i}] ${asVideoContent(segment.text)}`)
    .join("\n");
  return `
<video>
<title>${asVideoContent(input.video.title)}</title>
<channel>${asVideoContent(input.video.channel)}</channel>
<description>${input.video.description === null ? "unavailable" : asVideoContent(input.video.description)}</description>
<transcript>
${transcript}
</transcript>
</video>

Why they saved it: ${input.captureReason ?? "not said"}`;
}

export interface ComposedPrompt {
  systemPrompt: string;
  userMessage: string;
  schema: z.ZodObject<z.ZodRawShape>;
}

export const WRITING_RULES =
  "Never use an em dash (—) anywhere in your output; use a period or a comma instead. " +
  "Every field is read on screen and also read aloud, so write for the ear as well as the eye: " +
  "complete, natural sentences, no colons introducing lists, and no abbreviations a listener would have to decode. " +
  "Keep numbers, money and symbols as digits and symbols, such as $600, 20% or 8×7; they are converted for speech separately. " +
  "Brief parentheses are allowed only for a specific such as a year or a citation. They are not read aloud, " +
  "so never put anything the sentence needs inside them.";

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
      WRITING_RULES +
      instructions,
    userMessage: contextBlock(input),
    schema: z.object(shape),
  };
}
