import { wordCount } from "@overview/domain";
import type { GenerationInput } from "../GenerationInput.js";
import { noteBudget, type NoteBudget } from "../noteBudget.js";

export const transcriptWords = (input: Pick<GenerationInput, "transcript">): number =>
  input.transcript.reduce((total, segment) => total + wordCount(segment.text), 0);

export const transcriptBudget = (input: Pick<GenerationInput, "transcript">): NoteBudget => noteBudget("spoken", transcriptWords(input));
