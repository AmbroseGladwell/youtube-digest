import { z } from "zod";

// docs/architecture/v1-architecture-decisions.md: "LLM generation is Claude-only for v1" —
// this is the set of specific Claude models offered, not a provider choice. Kept as an
// explicit enum, not free text, so an invalid/retired model id fails at Settings.parse
// rather than as an opaque 404 from Anthropic mid-generation.
export const AnthropicModel = z.enum([
  "claude-opus-5",
  "claude-sonnet-5",
  "claude-haiku-4-5",
  "claude-fable-5-1",
]);
export type AnthropicModel = z.infer<typeof AnthropicModel>;

export interface AnthropicModelOption {
  id: AnthropicModel;
  label: string;
  description: string;
}

export const ANTHROPIC_MODEL_OPTIONS: AnthropicModelOption[] = [
  {
    id: "claude-opus-5",
    label: "Claude Opus 5",
    description: "The default — most capable for everyday generation.",
  },
  {
    id: "claude-sonnet-5",
    label: "Claude Sonnet 5",
    description: "Faster and cheaper, a step down in depth.",
  },
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    description: "Fastest and cheapest, least thorough.",
  },
  {
    id: "claude-fable-5-1",
    label: "Claude Fable 5.1",
    description: "Anthropic's most capable model, at a higher cost.",
  },
];

export const DEFAULT_ANTHROPIC_MODEL: AnthropicModel = "claude-opus-5";
