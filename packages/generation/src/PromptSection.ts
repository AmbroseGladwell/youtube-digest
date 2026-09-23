import type { z } from "zod";
import type { SectionsEnabled } from "@overview/domain";
import type { GenerationInput } from "./GenerationInput.js";

export interface PromptSection {
  title: string;
  key: keyof SectionsEnabled | "structural";
  prompt(input: GenerationInput): string;
  schemaShape(input: GenerationInput): z.ZodRawShape;
}
