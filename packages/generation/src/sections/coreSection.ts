import { CoreFields } from "@overview/types";
import type { PromptSection } from "../PromptSection.js";

export const coreSection: PromptSection = {
  title: "Core",
  key: "structural",
  prompt: () => `
## In one line
What this video IS, not what it argues. One sentence, 25 words at most.
Cover the format and the subject: who is talking and what territory it
covers. This is the line I read when scanning, so it has to be enough on
its own for me to remember which video this was.
Good: "A 20 minute talking head walking through screen time rules age by
age, from babies to teenagers."
Bad: "An insightful exploration of modern parenting challenges."
Never start it with "This video" or "A video about". Never repeat the
channel name — it already has its own field.

## Core claim
One sentence, 60 words at most. The single most important thing to take
from this video: the claim, if it's arguing one; the substance, plainly
described, if it's showing or explaining something instead. If it asserts
nothing and is pure vibes, say so plainly and set thin to true.

## Key points
3 to 5 bullets. Substance only. Strip the hook, the story, the
restatement, and the call to action.`,
  schemaShape: () => CoreFields.shape,
};
