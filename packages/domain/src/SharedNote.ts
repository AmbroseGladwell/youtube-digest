import { z } from "zod";
import { OverviewId } from "./Brands.js";
import { Chapters } from "./Chapter.js";
import { CoreFields } from "./CoreFields.js";
import { HowToApply } from "./HowToApply.js";
import { Selling } from "./Selling.js";
import { Verdict } from "./Verdict.js";
import { VideoSource } from "./VideoSource.js";
import { WatchAnyway } from "./WatchAnyway.js";

// The overview as someone without an account reads it: every field of Overview except the
// three the reader wrote for themselves. It is spelled out rather than derived from
// Overview by omission, so a field added to Overview is not in a shared copy until someone
// puts it here on purpose; sharedNoteFields.test.ts fails the moment the two drift
// (docs/features/sharing.md).
export const SharedNote = z
  .object({
    id: OverviewId,
    video: VideoSource,
    savedAt: z.iso.datetime(),
  })
  .extend(CoreFields.shape)
  .extend({
    verdict: Verdict.nullable(),
    selling: Selling.nullable(),
    howToApply: HowToApply.nullable(),
    watchAnyway: WatchAnyway.nullable(),
    chapters: Chapters.nullable(),
  });
export type SharedNote = z.infer<typeof SharedNote>;

export const SHARED_NOTE_FIELDS = Object.keys(SharedNote.shape).sort();

// What a shared copy never carries, listed where the snapshot builder and its test can both
// read it: the reason is the reader's own words, topics and tags are their filing, and read
// and favourite state was never on this record to begin with (docs/prototype/decisions.md).
export const PRIVATE_OVERVIEW_FIELDS = ["captureReason", "topicIds", "tags"] as const;
