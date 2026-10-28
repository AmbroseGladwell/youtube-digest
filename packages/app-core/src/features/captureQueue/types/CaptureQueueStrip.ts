import type { QueueHold } from "./QueueHold.js";
import type { LimitMessage } from "../../newOverview/util/limitMessage.js";

// The one strip the queue shows, in the generation strip's slot (design 27k).
export type CaptureQueueStrip =
  | { kind: "making"; position: number; total: number; step: string; title: string; progress: number; tomorrow: number }
  | { kind: "paused"; waiting: number }
  | { kind: "held"; hold: QueueHold; waiting: number; viaExtension: boolean; limit: LimitMessage | null }
  | { kind: "checked"; playlists: number; queued: number }
  | { kind: "noKey"; waiting: number }
  | { kind: "attention"; failed: number; skipped: number }
  | { kind: "doneForToday"; tomorrow: number }
  | { kind: "waitingForYou"; waiting: number; playlists: string[] }
  | { kind: "done"; made: number };
