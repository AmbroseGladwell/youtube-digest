import {
  FOLLOW_UP_QUESTION_MAX_WORDS,
  FOLLOW_UP_QUESTION_TARGET_WORDS,
  FOLLOW_UP_QUESTIONS_SHOWN,
  MOST_FOLLOW_UP_QUESTIONS,
  MOST_READER_QUESTIONS,
  wordCount,
  type FollowUpQuestion,
  type FollowUpQuestions,
} from "@overview/domain";
import { z } from "zod";
import type { PromptSection } from "../PromptSection.js";

export type QuestionedSource = "video" | "article" | "recipe";

const GOOD: Record<QuestionedSource, string> = {
  video: `"Why does the keeper test ask who a manager would fight to keep, rather than who to let go?"
"What goes wrong when a team treats a shipped feature as a finished one?"`,
  article: `"Why does the keeper test ask who a manager would fight to keep, rather than who to let go?"
"What goes wrong when a team treats a shipped feature as a finished one?"`,
  recipe: `"Why does frying the tomato paste until it darkens deepen the flavour of the rice?"
"How does washing the rice first change the texture of the finished dish?"`,
};

const readerQuestions = (source: QuestionedSource) => `Let the reader shape which ideas you ask about: prefer the ones that bear
most on their work, interests and what they are trying to do.

readerQuestions: up to ${MOST_READER_QUESTIONS} questions that link one specific idea from the
${source} to something the reader already does, asked from where they stand.
Write one only where the connection is real and the answer would tell
them something they couldn't get by asking about the ${source} alone: how
the idea changes, breaks or matters in their situation. A question that
just adds "for me" or "in my business" to a general one is forced, and so
is any reader question when the ${source} has little to do with their life.
Never ask about an idea one of the other questions already takes: a
reader question is about a different idea, not the same one again.
Then write none: an empty list is often the right answer. Never give them
a new project, role or occasion just to hang a question on. These count
towards the ${MOST_FOLLOW_UP_QUESTIONS}, best first; they are shown one in each ${FOLLOW_UP_QUESTIONS_SHOWN} beside the others.`;

const readerFit = (source: QuestionedSource, readerContext: string | null, describedAbove: boolean): string => {
  if (readerContext === null) {
    return "";
  }
  return describedAbove
    ? `\n\n${readerQuestions(source)} The reader is described under How to apply.`
    : `\n\nAbout the reader, for fit: ${readerContext}\n\n${readerQuestions(source)}`;
};

export const followUpQuestionsInstructions = (source: QuestionedSource, readerContext: string | null, describedAbove: boolean) => `
## Questions to ask next
Up to ${MOST_FOLLOW_UP_QUESTIONS} questions I could ask an assistant to understand this ${source}
better, each one genuinely worth asking. Each takes one specific idea, term
or technique from the ${source} and asks why it matters, how it works, or
what goes wrong without it: the questions a thoughtful reader would want
answered after reading the note, which open up the reasoning behind an
idea rather than restating it. These are for learning, not for checking
whether the ${source} is right. Take each from the note's key points or
chapters, so the question can be answered from the note.

followUpQuestions: questions about the ${source} itself. They are shown ${FOLLOW_UP_QUESTIONS_SHOWN} at a
time, in your order, so put the ones most worth asking first. Spread them
across as many of the ${source}'s ideas as you can. When it has too few
ideas for ${MOST_FOLLOW_UP_QUESTIONS} good questions, give fewer: never two questions on the same
idea, and never one just to fill the list.

Each is one sentence, about ${FOLLOW_UP_QUESTION_TARGET_WORDS} words. Never ask what the note
already answers in full, and never a generic question such as "Tell me
more" or "What are the main takeaways?". Each question is read on its
own, away from the note, so name the idea it is about rather than saying
"this" or "the ${source}".
Good: ${GOOD[source]}
Bad: "What else does it say?"${readerFit(source, readerContext, describedAbove)}`;

export const followUpQuestionsShape = () => ({
  followUpQuestions: z.string().array(),
  readerQuestions: z.string().array(),
});

const sameness = (question: string): string =>
  question
    .toLowerCase()
    .replace(/[\s\p{P}]+/gu, " ")
    .trim();

const usable = (written: string[], taken: Set<string>): string[] =>
  written
    .map((question) => question.trim())
    .filter((question) => {
      const key = sameness(question);
      if (key === "" || wordCount(question) > FOLLOW_UP_QUESTION_MAX_WORDS || taken.has(key)) {
        return false;
      }
      taken.add(key);
      return true;
    });

export const resolvedFollowUpQuestions = (aboutSource: string[], forReader: string[]): FollowUpQuestions => {
  const taken = new Set<string>();
  const readers = usable(forReader, taken).slice(0, MOST_READER_QUESTIONS);
  const sources = usable(aboutSource, taken);
  const resolved: FollowUpQuestion[] = [];
  while (sources.length > 0 && resolved.length < MOST_FOLLOW_UP_QUESTIONS) {
    const reader = readers.shift();
    const set = sources.splice(0, reader === undefined ? FOLLOW_UP_QUESTIONS_SHOWN : FOLLOW_UP_QUESTIONS_SHOWN - 1);
    const questions = set.map((question) => ({ question, forReader: false }));
    if (reader !== undefined) {
      questions.splice(1, 0, { question: reader, forReader: true });
    }
    resolved.push(...questions);
  }
  return resolved.slice(0, MOST_FOLLOW_UP_QUESTIONS);
};

export const followUpQuestionsSection: PromptSection = {
  title: "Questions to ask next",
  key: "structural",
  prompt: (input) => followUpQuestionsInstructions("video", input.readerContext, input.sectionsEnabled.howToApply),
  schemaShape: followUpQuestionsShape,
};

export const recipeFollowUpQuestionsSection: PromptSection = {
  ...followUpQuestionsSection,
  prompt: (input) => followUpQuestionsInstructions("recipe", input.readerContext, false),
};
