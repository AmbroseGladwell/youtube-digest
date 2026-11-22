import { wordCount } from "@overview/domain";
import type { GenerationInput } from "../GenerationInput.js";
import { NoSpeechError } from "../GenerationError.js";
import { NO_SPEECH_WORDS, noteBudget, type NoteBudget } from "../noteBudget.js";

export const transcriptWords = (input: Pick<GenerationInput, "transcript">): number =>
  input.transcript.reduce((total, segment) => total + wordCount(segment.text), 0);

export const transcriptBudget = (input: Pick<GenerationInput, "transcript">): NoteBudget => noteBudget("spoken", transcriptWords(input));

export const refuseWithoutSpeech = (input: Pick<GenerationInput, "transcript">): void => {
  if (transcriptWords(input) < NO_SPEECH_WORDS) {
    throw new NoSpeechError("too-few-words");
  }
};
