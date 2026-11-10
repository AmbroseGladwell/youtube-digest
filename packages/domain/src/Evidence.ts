import { z } from "zod";
import { TimeRange } from "./WatchAnyway.js";

// A quotation illustrates a key point with the source's own words: an example, a story, a
// demonstration or the data behind it, never the claim said again (OV-216, owner 10 Nov 2026).
// Code lifts it from the place the model named and never writes it; a passage longer than this
// is dropped rather than cut, so a quotation is always whole.
export const EVIDENCE_MOST_WORDS = 70;

// An article's quotation has no time; it is found on the page by its own words.
export const Evidence = z.object({
  text: z.string().min(1),
  range: TimeRange.nullable(),
});
export type Evidence = z.infer<typeof Evidence>;
