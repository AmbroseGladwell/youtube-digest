import { z } from "zod";
import { wordCount } from "@overview/domain";
import { mostBigPictureWords } from "../bigPictureBudget.js";

export interface BigPictureWording {
  source: "video" | "piece";
  good: string;
}

export function bigPicturePrompt(targetWords: number, { source, good }: BigPictureWording): string {
  if (targetWords === 0) {
    return `
## Big picture
This ${source} is short, so leave bigPicture empty: In one line and the core
claim are enough.`;
  }
  return `
## Big picture
The ground the core claim stands on, ${targetWords} words at most. It is read first,
before the core claim, so it orients me before the argument arrives. Say
what question the ${source} is engaging and why that question matters. Then
name anything else substantial it covers that the core claim cannot hold,
because the core claim is one thing: a second thread, or the case the
whole argument rests on.

The three fields must not repeat each other. In one line says what the
${source} is; the big picture says what ground it stands on and what else is
here; the core claim says what it answers. So the big picture is about
the subject, never the ${source} itself: no format, no speakers, no length, and
never the core claim's answer. If removing it would lose nothing that In
one line and the core claim don't already say, it has failed.

Leave it empty rather than pad. When the ${source} has one thread and the
core claim already holds it, an empty big picture is right.
Good: "${good}"
Bad: "A wide-ranging look at the subject, full of practical insights and food for thought."`;
}

export const bigPictureShape = (targetWords: number) => {
  const mostWords = mostBigPictureWords(targetWords);
  return targetWords === 0 ? z.string() : z.string().refine((text) => wordCount(text) <= mostWords, `max ${mostWords} words`);
};

// A short source earns none, whatever the model wrote; an empty one is none too.
export const resolvedBigPicture = (targetWords: number, text: string): string | null => {
  const trimmed = text.trim();
  return targetWords === 0 || trimmed === "" ? null : trimmed;
};
