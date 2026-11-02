import type { ArticleNote } from "@overview/domain";
import { requestGeneratedOutput, type GenerationClient } from "../generateOverview.js";
import type { ArticleGenerationInput } from "./ArticleGenerationInput.js";
import { assembleArticleNote, type GeneratedArticleOutput } from "./assembleArticleNote.js";
import { composeArticlePrompt } from "./composeArticlePrompt.js";

export async function generateArticleNote(client: GenerationClient, input: ArticleGenerationInput): Promise<ArticleNote> {
  const output = await requestGeneratedOutput<GeneratedArticleOutput>(client, composeArticlePrompt(input));
  return assembleArticleNote(input, output);
}
