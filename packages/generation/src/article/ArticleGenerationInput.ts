import type { ExtractedArticle } from "@overview/domain";
import type { GenerationInput } from "../GenerationInput.js";

export type ArticleGenerationInput = Omit<GenerationInput, "video" | "transcript"> & { article: ExtractedArticle };
