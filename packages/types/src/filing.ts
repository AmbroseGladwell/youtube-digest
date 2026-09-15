import { z } from "zod";

/**
 * Topics and tags are both label sets on a note, but they do different
 * jobs and are deliberately not unified into one mechanism — see
 * docs/note-generation-decisions.md, "Topics: user-defined, not a fixed
 * enum" and "Resolved: Topics and Tags stay separate...".
 */
export const Filing = z.object({
  /**
   * Topic IDs this note is filed under. User-defined and multi-select —
   * empty means unsorted, either because nothing matched or because the
   * user hasn't created a fitting topic yet, both honest states rather
   * than a failure. References a per-user Topic entity that belongs at the
   * store layer, not in this package, which only knows the shape of a
   * note. Topics are the interactive filter, shown and chosen in the
   * filter area — the model suggests a topic, it never creates one
   * silently.
   */
  topicIds: z.array(z.string()),

  /**
   * 3 to 6 tags, lowercase and hyphenated. A scanning aid only, not a
   * search mechanism — the rest of the note (title, claim, reasoning, key
   * points, how-to-apply, selling) is already fully searchable, and
   * checking every tag in this design's sample set against that found zero
   * unique recall added by any of them. Not interactive, and not held to
   * the same cross-note consistency as topics: a scanning aid tolerates
   * "ai" on one note and "artificial-intelligence" on another in a way a
   * click-to-filter facet could not.
   */
  tags: z
    .array(z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/))
    .min(3)
    .max(6),
});
export type Filing = z.infer<typeof Filing>;
