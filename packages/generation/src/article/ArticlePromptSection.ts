import type { z } from "zod";
import type { SectionsEnabled } from "@overview/domain";
import type { ArticleGenerationInput } from "./ArticleGenerationInput.js";

export interface ArticlePromptSection {
  key: keyof SectionsEnabled | "structural";
  prompt(input: ArticleGenerationInput): string;
  schemaShape(input: ArticleGenerationInput): z.ZodRawShape;
}
