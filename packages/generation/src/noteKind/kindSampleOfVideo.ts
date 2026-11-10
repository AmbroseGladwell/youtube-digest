import { wordCount } from "@overview/domain";
import type { GenerationInput } from "../GenerationInput.js";
import { descriptionOf } from "../recipe/videoRecipe.js";
import type { KindSample } from "./KindSample.js";

// About the first four minutes of speech.
export const KIND_CHECK_OPENING_WORDS = 600;

export function kindSampleOfVideo(input: GenerationInput): KindSample {
  const opening: string[] = [];
  let words = 0;
  for (const { text } of input.transcript) {
    if (words >= KIND_CHECK_OPENING_WORDS) break;
    opening.push(text);
    words += wordCount(text);
  }
  return { title: input.video.title, by: input.video.channel, description: descriptionOf(input), opening: opening.join(" ") };
}
