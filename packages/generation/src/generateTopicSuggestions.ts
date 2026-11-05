import { z } from "zod";
import {
  sameTopicName,
  STARTER_TOPICS,
  TOPIC_SUGGESTION_NEW_NAME_CHARACTERS,
  type TopicSuggestionInput,
  type TopicSuggestionResult,
} from "@overview/domain";
import type { GenerationClient } from "./generateOverview.js";
import { GenerationError } from "./GenerationError.js";

const SUGGESTED_AT_MOST = 3;
const NEW_TOPIC_WORDS = 4;

// The starter topics a source about to be written belongs under, and at most one more specific
// interest it's clearly about, offered on onboarding's topics screen before there's an account
// (docs/features/onboarding.md, "Suggested topics"). Offered, never chosen: the reader picks.
export async function generateTopicSuggestions(client: GenerationClient, input: TopicSuggestionInput): Promise<TopicSuggestionResult> {
  const names = STARTER_TOPICS.map((topic) => topic.name) as [string, ...string[]];
  const Output = z.object({
    starterTopicNames: z.array(z.enum(names)),
    newTopicName: z.string().nullable(),
  });
  const raw = await client({
    systemPrompt: `A new reader is choosing the topics their library will be sorted into. Suggest a few
for the ${input.kind} they're about to have summarised.

The topics on offer:
${STARTER_TOPICS.map((topic) => `- "${topic.name}": ${topic.description}`).join("\n")}

Name up to ${SUGGESTED_AT_MOST} of them that this ${input.kind} would clearly be filed under, the best fit
first. Fewer is fine, and none is an honest answer.

The topics on offer are deliberately broad. You may also name one more specific interest, in
newTopicName, when the ${input.kind} is clearly about one: the kind of thing a person follows and
would want a shelf for, such as "Knife skills" within Food, "Chess" within Gaming, "Sourdough",
"Marathon training" or "Personal finance for freelancers". It may sit inside a topic on offer.

It's a home for many future overviews, not a summary of this one, so it's an interest, not a tag:
- "Knife skills", not "Dicing onions" or "Claw grip";
- "Chess", not "The Sicilian Defence in blitz";
- one to four words, sentence case, in the list's plain style;
- never a topic on offer or a synonym of one, never the ${input.kind}'s own title, a person, a
  brand or a channel.

When the ${input.kind} is general, or no such interest stands out, it's null.`,
    userMessage: [`Title: ${input.title}`, ...(input.text.trim() === "" ? [] : ["", input.text])].join("\n"),
    schema: Output,
  });
  const parsed = Output.safeParse(raw);
  if (!parsed.success) {
    throw new GenerationError(`topic suggestions failed their schema: ${parsed.error.message}`);
  }
  const named = parsed.data.newTopicName?.trim() ?? "";
  const usable =
    named !== "" &&
    named.length <= TOPIC_SUGGESTION_NEW_NAME_CHARACTERS &&
    named.split(/\s+/).length <= NEW_TOPIC_WORDS &&
    !STARTER_TOPICS.some((topic) => sameTopicName(topic.name, named));
  // The specific interest is the one most worth offering, so it keeps its place in the three.
  const starter = [...new Set(parsed.data.starterTopicNames)].slice(0, usable ? SUGGESTED_AT_MOST - 1 : SUGGESTED_AT_MOST);
  return { starter, newTopic: usable ? named : null };
}
