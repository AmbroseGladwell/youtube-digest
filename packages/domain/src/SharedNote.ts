import { z } from "zod";
import { OverviewId } from "./Brands.js";
import { Chapters } from "./Chapter.js";
import { CoreFields } from "./CoreFields.js";
import { Filing } from "./Filing.js";
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
  .extend({ tags: Filing.shape.tags })
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
// read it: the reason is the reader's own words, topics are their filing, the playlist is
// their own list, and read and favourite state was never on this record to begin with
// (docs/prototype/decisions.md).
//
// Tags are not among them, and the dialog's own "Kept private" list does not claim they
// are: they are written with the note rather than by the reader, the reader's own Overview
// tab prints them, and a copy without them is not a whole overview (docs/features/sharing.md).
export const PRIVATE_OVERVIEW_FIELDS = ["captureReason", "topicIds", "fromPlaylist"] as const;
