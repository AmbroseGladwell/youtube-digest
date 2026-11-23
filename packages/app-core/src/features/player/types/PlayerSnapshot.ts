import type { NarrationVoice } from "@overview/domain";
import type { LineTimings } from "../util/estimatedLineStarts.js";
import type { PlayerTrack } from "./PlayerTrack.js";

// Every state the bar draws: docs/features/audio-player.md, "The states".
export type PlayerStatus = "ready" | "preparing" | "playing" | "paused" | "buffering" | "ended" | "failed" | "busy";

export type PlayerSource = "audio" | "pacer";

export type PacerReason = "signedOut" | "unavailable" | "dailyCap" | "meanwhile" | "chosen";

export type NarrationAvailability = "checking" | "ready" | "onFirstPlay" | "preparing";

export type PreparingStep = "queued" | "rendering";

export interface PlayerSnapshot {
  track: PlayerTrack | null;
  status: PlayerStatus;
  source: PlayerSource;
  pacerReason: PacerReason | null;
  availability: NarrationAvailability;
  preparing: { step: PreparingStep; long: boolean } | null;
  timings: LineTimings;
  rate: number;
  // narratedVoice differs from voice for older audio: docs/features/narration-voice.md, "Old audio".
  voice: NarrationVoice;
  narratedVoice: NarrationVoice | null;
  // When it is set and cleared: docs/features/audio-player.md, "Which note the bar is about".
  docked: boolean;
  // Narration playing while it is still made: docs/features/audio-player.md, "Playing while it renders".
  stream: StreamProgress | null;
}

export interface StreamProgress {
  renderedSeconds: number;
  holdingLine: number | null;
}
