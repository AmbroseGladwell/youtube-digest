import type { NarrationVoice } from "@overview/domain";
import type { LineTimings } from "../util/estimatedLineStarts.js";
import type { PlayerTrack } from "./PlayerTrack.js";

// Design Player.dc.html, section 1: every state the bar draws.
export type PlayerStatus = "ready" | "preparing" | "playing" | "paused" | "buffering" | "ended" | "failed" | "busy";

// Narrated audio, or the pacer walking the note at an estimated pace.
export type PlayerSource = "audio" | "pacer";

// Why the pacer is running rather than audio, which is what its label says (1k, 1l, 1d).
export type PacerReason = "signedOut" | "unavailable" | "meanwhile" | "chosen";

// Before the first press: whether the audio exists (1a), is made on first play (1b), or is
// already on its way because something else asked for it (OV-44, 44a).
export type NarrationAvailability = "checking" | "ready" | "onFirstPlay" | "preparing";

export type PreparingStep = "queued" | "rendering";

export interface PlayerSnapshot {
  track: PlayerTrack | null;
  status: PlayerStatus;
  source: PlayerSource;
  pacerReason: PacerReason | null;
  availability: NarrationAvailability;
  // What the server said while a render is waited on, or watched while availability is
  // preparing.
  preparing: { step: PreparingStep; long: boolean } | null;
  // Measured by the renderer while the source is audio; estimated from the words for the
  // pacer and for audio that does not exist yet.
  timings: LineTimings;
  rate: number;
  voice: NarrationVoice;
}
