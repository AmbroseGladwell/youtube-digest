import { z } from "zod";
import { quotationPrompt } from "./quotationPrompt.js";
import { CoreFields, IN_ONE_LINE_TARGET_WORDS, wordCount } from "@overview/domain";
import type { PromptSection } from "../PromptSection.js";
import { LEAST_KEY_POINTS, mostQuotations, mostWordsPerKeyPoint, type NoteBudget } from "../noteBudget.js";
import { bigPicturePrompt, bigPictureShape } from "./bigPicturePrompt.js";
import { quoteRangeFields, segmentRangeFields } from "./segmentRangeFields.js";
import { transcriptBudget } from "./transcriptBudget.js";

const { inOneLine, ...afterInOneLine } = CoreFields.shape;

const howManyKeyPoints = ({ keyPoints, long }: NoteBudget): string =>
  long
    ? `Most videos need five or fewer, but one this long covers more ground:
use up to ${keyPoints}, and spend them across the whole of it. ${keyPoints} is the ceiling, so
keep the ones that matter most. Together the points have to represent the
whole video through to its end, not just its opening: never spend them
all on the first hour, and never leave out a long stretch that carries
real substance. Chapters are never read aloud, so a point left out here
is lost to anyone listening.`
    : `Most videos need five or fewer. Seven is the ceiling for a video this
length, so keep the ones that matter most and let the chapters carry the
rest of the structure.`;

const GOOD_BIG_PICTURE =
  "Parents get conflicting advice about screens, and the question underneath is whether the harm comes from the screen itself or from what it pushes out, such as sleep and play. It also covers how to talk to a teenager about their phone.";

export const coreSection: PromptSection = {
  title: "Core",
  key: "structural",
  prompt: (input) => {
    const budget = transcriptBudget(input);
    return `
## In one line
What this video IS, not what it argues. One sentence, ${IN_ONE_LINE_TARGET_WORDS} words at most.
Cover the format and the subject: who is talking and what territory it
covers. This is the line I read when scanning, so it has to be enough on
its own for me to remember which video this was.
Good: "A 20 minute talking head walking through screen time rules age by
age, from babies to teenagers."
Bad: "An insightful exploration of modern parenting challenges."
Never start it with "This video" or "A video about". Never repeat the
channel name — it already has its own field.
${bigPicturePrompt(budget.bigPictureWords, { source: "video", good: GOOD_BIG_PICTURE })}

## Core claim
One sentence, 60 words at most. The single most important thing to take
from this video: the claim, if it's arguing one; the substance, plainly
described, if it's showing or explaining something instead. If it asserts
nothing and is pure vibes, say so plainly and set thin to true.

## Key points
${LEAST_KEY_POINTS} to ${budget.keyPoints} points. Choose them by what I need to understand, never by where
they come in the video: the ideas the rest of it depends on, and what is
genuinely new, surprising or contested. Leave out anything I could work
out from the premise alone, and strip the hook, the story, the
restatement, and the call to action. On a long video, weigh the whole of
it before choosing: the idea that matters most may come in the second
hour. Then give the points you chose in the order the video makes them.
${howManyKeyPoints(budget)}

Each point is one to three complete sentences, ${budget.wordsPerKeyPoint} words at most,
that make sense heard on their own: never a noun phrase or a fragment.
Most points need one or two sentences. Use a further sentence for the
specific detail or example rather than dropping it, and never to restate.

Keep the specifics that make a point worth having: names, numbers,
dates, studies, and the concrete cues or steps. Always keep any caveat,
criticism or counter-argument the video itself raises, and keep who
claims something when the video presents it as one person's claim rather
than settled fact. When the video generalises from a single story or
case, say the claim rests on it rather than stating it as established.

Each is read aloud after a linking word such as "First," or "Then,", so
never open a point with its own number, a label and a colon, or a heading.
Good: "Adding sets grows the arms faster than adding weight, as long as
each set is taken close to failure."
Bad: "Volume over load."

Give each point the stretch of the video it comes from, as
startSegmentIndex/endSegmentIndex taken from the numbered transcript
segments below, so the reader can go to it; don't estimate a time. Set
both to -1 for a point the video builds across several places rather
than in one stretch.
${quotationPrompt({
  source: "video",
  most: mostQuotations(budget),
  where:
    "as quoteStartSegmentIndex/quoteEndSegmentIndex, the segments inside that point's own stretch where it begins and ends, from the numbered transcript segments below.",
})}`;
  },
  schemaShape: (input) => {
    const budget = transcriptBudget(input);
    const mostWords = mostWordsPerKeyPoint(budget);
    return {
      inOneLine,
      bigPicture: bigPictureShape(budget.bigPictureWords),
      ...afterInOneLine,
      keyPoints: z
        .object({
          text: z.string().refine((point) => wordCount(point) <= mostWords, `max ${mostWords} words`),
          ...segmentRangeFields(input),
          ...quoteRangeFields(input),
        })
        .array()
        .min(LEAST_KEY_POINTS)
        .max(budget.keyPoints),
    };
  },
};
