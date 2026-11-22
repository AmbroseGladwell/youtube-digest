// What each field is for: docs/features/overview-redesign.md, "What a note line carries".
import type { TimeRange } from "./WatchAnyway.js";

export interface NoteLine {
  section: string;
  heading: boolean;
  bullet: boolean;
  text: string;
  spoken?: string;
  range?: TimeRange;
  // The chapter of an article a key point comes from, the counterpart of `range`.
  chapterIndex?: number;
  label?: string;
  chip?: string;
  aside?: string;
  dubiousReason?: string;
}
