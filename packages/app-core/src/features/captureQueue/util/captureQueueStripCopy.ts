import type { CaptureQueueStrip } from "../types/CaptureQueueStrip.js";

const plural = (count: number, one: string, many: string) => `${count.toLocaleString("en-GB")} ${count === 1 ? one : many}`;

export interface CaptureQueueStripCopy {
  title: string;
  meta: string | null;
}

// Design 27k's words for each state, wide and compact (27n, 27o).
export function captureQueueStripCopy(strip: CaptureQueueStrip, compact: boolean): CaptureQueueStripCopy {
  switch (strip.kind) {
    case "making":
      return { title: `Making ${strip.position} of ${strip.total}`, meta: `${strip.step} · ${strip.title}` };
    case "paused":
      return compact
        ? { title: `Queue paused · ${strip.waiting.toLocaleString("en-GB")} waiting`, meta: null }
        : { title: "Queue paused", meta: `${strip.waiting.toLocaleString("en-GB")} waiting · nothing is made until you resume` };
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
    case "attention":
      return {
        title: `Queue done · ${(strip.failed + strip.skipped).toLocaleString("en-GB")} need attention`,
        meta: [strip.failed > 0 ? `${strip.failed} failed` : null, strip.skipped > 0 ? `${strip.skipped} skipped` : null]
          .filter((part): part is string => part !== null)
          .join(", "),
      };
    case "done":
      return { title: `Queue done · ${strip.made.toLocaleString("en-GB")} made`, meta: null };
  }
}
