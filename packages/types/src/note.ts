import { z } from "zod";
import { VideoSource, CoreFields } from "./core.js";
import { Filing } from "./filing.js";
import { Verdict } from "./verdict.js";
import { Selling } from "./selling.js";
import { HowToApply } from "./how-to-apply.js";
import { WatchAnyway } from "./watch-anyway.js";

/**
 * The record one generation call produces, and the shape the library
 * renders and speaks. Every field that isn't self-explanatory is argued
 * for in docs/note-generation-decisions.md — this file is the schema, that
 * doc is the reasoning, and neither should drift from the other silently.
 *
 * Deliberately excluded: read/favourite state, or any other per-user flag.
 * That lives in its own table, keyed by note id, never on the note itself —
 * a generation re-run can replace this whole record, and user-set flags
 * must survive that (docs/decisions.md, "User state lives apart from the
 * note").
 */
export const Note = z
  .object({
    id: z.string(),
    video: VideoSource,
    savedAt: z.string().datetime(),
    /** The user's own note at save time, if any. */
    savedNote: z.string().nullable(),
  })
  .merge(CoreFields)
  .merge(Filing)
  .extend({
    /**
     * Each of these four is `null` when its toggle was off for this
     * generation call — the composable prompt drops the field from the
     * request schema entirely rather than asking the model to skip a
     * field it was still given room to fill in. `verdict` has a second,
     * indistinguishable-from-here reason to be `null`: see `thin` above.
     */
    verdict: Verdict.nullable(),
    selling: Selling.nullable(),
    howToApply: HowToApply.nullable(),
    watchAnyway: WatchAnyway.nullable(),
  });
export type Note = z.infer<typeof Note>;
