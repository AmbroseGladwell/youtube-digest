import { z } from "zod";

/**
 * The video being digested. Structural — always present, never toggleable.
 *
 * `durationMs` is only real for notes generated after transcript retrieval
 * was pinned to Supadata (docs/v1-architecture-decisions.md): its `native`
 * mode carries YouTube's own caption-track timing, so duration stops being
 * a word-count estimate. Older notes carry `null` here and cannot be
 * backfilled without a re-fetch of their source video.
 */
export const VideoSource = z.object({
  url: z.string().url(),
  title: z.string(),
  channel: z.string(),
  /**
   * Trimmed to 400 characters at generation time. `null` when the
   * description couldn't be retrieved — never guessed or reconstructed
   * from the transcript (prototype/summary-prompt.md's own instruction).
   */
  description: z.string().max(400).nullable(),
  durationMs: z.number().int().positive().nullable(),
});
export type VideoSource = z.infer<typeof VideoSource>;

/**
 * The structural fields of a note: always generated, never toggleable.
 * There is no note, and nothing to file, without these
 * (docs/note-generation-decisions.md, "The composable prompt").
 */
export const CoreFields = z.object({
  /**
   * What the video IS, not what it argues — format, speaker, territory.
   * Max 25 words. Never names the creator/channel here; that's
   * `VideoSource.channel`'s job only (docs/note-generation-decisions.md,
   * "In one line, Core claim, Key points").
   */
  inOneLine: z.string(),

  /**
   * The single assertion. Max 60 words — a deliberate backstop, not a
   * tightening: every sample this was measured against already sits well
   * under it (34-55 words), because a fuller claim is judged worth keeping
   * here for the clearer picture it paints. Supporting reasoning belongs in
   * `keyPoints`, not stacked into this sentence via "because"/"so" clauses.
   */
  coreClaim: z.string(),

  /**
   * True when the video asserts nothing worth judging ("pure vibes"). Set
   * explicitly by the generation step rather than inferred later from
   * `coreClaim`'s wording — the whole point of moving to structured output
   * was to stop re-parsing generated prose for meaning it should have
   * carried as data. Gates Verdict: when true, `Note.verdict` is `null`
   * regardless of whether Verdict was requested for this call.
   *
   * Untested: what `keyPoints` should look like when this is true. Zero of
   * the five real samples this design was checked against hit this case.
   */
  thin: z.boolean(),

  /**
   * 3 to 5 items, substance only — hook, story, restatement and call to
   * action stripped. Enforced here, not just asked for in the prompt: a
   * real sample (interesting/heartbeats) already came back with six under
   * free-text generation, which structured output's array bounds catch
   * that a prompt instruction alone did not.
   */
  keyPoints: z.array(z.string()).min(3).max(5),
});
export type CoreFields = z.infer<typeof CoreFields>;
