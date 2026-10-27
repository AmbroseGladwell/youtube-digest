import { resumeTimeText } from "../../transcripts/util/resumeTime.js";
import type { CaptureQueueStrip } from "../types/CaptureQueueStrip.js";
import { TRIAL_SPENT_HEADING } from "../../signedOutTrial/trialPrompt.js";
import { queueHoldStripMeta } from "./queueHoldCopy.js";

const plural = (count: number, one: string, many: string) => `${count.toLocaleString("en-GB")} ${count === 1 ? one : many}`;

export interface CaptureQueueStripCopy {
  title: string;
  meta: string | null;
  // Said after the meta, quieter: what waits on a pace while the rest is made (95ab).
  after?: string;
}

// Design 27k's words for each state, wide and compact (27n, 27o), with 95ac's for a queue
// waiting on its playlists' paces.
export function captureQueueStripCopy(strip: CaptureQueueStrip, compact: boolean): CaptureQueueStripCopy {
  switch (strip.kind) {
    case "making": {
      const title = `Making ${strip.position} of ${strip.total}`;
      const tomorrow = `${strip.tomorrow.toLocaleString("en-GB")} continue tomorrow`;
      if (strip.tomorrow === 0) return { title, meta: `${strip.step} · ${strip.title}` };
      return compact ? { title, meta: tomorrow } : { title, meta: `${strip.step} · ${strip.title}`, after: `· ${tomorrow}` };
    }
    case "paused":
      return compact
        ? { title: `Queue paused · ${strip.waiting.toLocaleString("en-GB")} waiting`, meta: null }
        : { title: "Queue paused", meta: `${strip.waiting.toLocaleString("en-GB")} waiting · nothing is made until you resume` };
    case "held":
      return compact
        ? { title: `Waiting · ${strip.waiting.toLocaleString("en-GB")} continue after ${resumeTimeText(new Date(strip.hold.resumesAt))}`, meta: null }
        : { title: "Waiting for our server", meta: queueHoldStripMeta(strip.hold, strip.waiting, strip.viaExtension) };
    case "checked":
      return {
        title: `Checked ${plural(strip.playlists, "playlist", "playlists")}`,
        meta: `${plural(strip.queued, "new video", "new videos")} queued · starting with the oldest`,
      };
    case "noKey":
      return compact
        ? { title: `${strip.waiting.toLocaleString("en-GB")} waiting for an API key`, meta: null }
        : {
            title: `${plural(strip.waiting, "video is", "videos are")} waiting for an API key`,
            meta: "Nothing can be made without one",
          };
    case "trialSpent":
      return compact
        ? { title: `${strip.waiting.toLocaleString("en-GB")} waiting · sign up to keep going`, meta: null }
        : {
            title: TRIAL_SPENT_HEADING,
            meta: `${plural(strip.waiting, "video waits", "videos wait")} for an account · a free one makes 15 a month`,
          };
    case "attention":
      return {
        title: `Queue done · ${(strip.failed + strip.skipped).toLocaleString("en-GB")} need attention`,
        meta: [strip.failed > 0 ? `${strip.failed} failed` : null, strip.skipped > 0 ? `${strip.skipped} skipped` : null]
          .filter((part): part is string => part !== null)
          .join(", "),
      };
    case "doneForToday":
      return {
        title: "Done for today",
        meta: `${strip.tomorrow.toLocaleString("en-GB")} waiting for tomorrow${compact ? "" : ", at each playlist’s pace"}`,
      };
    case "waitingForYou":
      return {
        title: `Queue done · ${strip.waiting.toLocaleString("en-GB")} waiting for you`,
        meta: compact
          ? null
          : `From ${strip.playlists.length === 1 ? strip.playlists[0] : plural(strip.playlists.length, "playlist", "playlists")}, made when you choose them`,
      };
    case "done":
      return { title: `Queue done · ${strip.made.toLocaleString("en-GB")} made`, meta: null };
  }
}
