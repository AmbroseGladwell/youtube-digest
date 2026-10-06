import type { QueueHold } from "./QueueHold.js";

// The one strip the queue shows, in the generation strip's slot (design 27k).
export type CaptureQueueStrip =
  | { kind: "making"; position: number; total: number; step: string; title: string; progress: number }
  | { kind: "paused"; waiting: number }
  | { kind: "held"; hold: QueueHold; waiting: number; viaExtension: boolean }
  | { kind: "checked"; playlists: number; queued: number }
  | { kind: "noKey"; waiting: number }
  | { kind: "attention"; failed: number; skipped: number }
  | { kind: "done"; made: number };
