import { WatchAnyway } from "@overview/domain";
import type { PromptSection } from "../PromptSection.js";
import { segmentRangeFields } from "../sections/segmentRangeFields.js";

// Watch it anyway, forked rather than reworded: its yes is about what a video shows, and an episode
// has nothing to show. It keeps the key and the shape, so a podcast note's answer sits where a
// video's does (docs/features/podcast-notes.md, "Listen to it anyway").
export const listenAnywaySection: PromptSection = {
  title: "Listen to it anyway",
  key: "watchAnyway",
  prompt: () => `
## Listen to it anyway?
Yes, no, or partial, plus a reason. Default to no. Say yes only if how it
is said IS the point: a story whose telling is the thing worth having,
a performance or a piece of music, an exchange whose tone or tension
carries what the words alone would lose, or a voice I'd want to hear for
itself. It is not enough that the conversation is pleasant, that the
hosts are good company, or that listening would be nicer than reading.
If a competent written account would get me to the same place, the
answer is no. Assume I am trying to stop listening to these, and that a
soft yes costs me an hour I will not get back.

The reason is read aloud straight after the answer, as in "No, you can
probably skip the episode, the overview covers it." followed by the
reason, so never restate yes, no, or skip in it. Give the reason itself
in one or two sentences. Never count anything in it, such as how many
steps or points there are, and never say how much of the episode
something takes up: say what the parts are, not how many or how long.

Say partial when this is true of only part of the episode. When you do,
name the range as startSegmentIndex/endSegmentIndex, taken from the
numbered transcript segments below — pick the segment numbers that bound
the part worth hearing, don't estimate a time. Otherwise set both to -1.`,
  schemaShape: (input) => ({
    answer: WatchAnyway.shape.answer,
    reason: WatchAnyway.shape.reason,
    ...segmentRangeFields(input),
  }),
};
