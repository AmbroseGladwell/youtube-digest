// One tappable line of the read-along body. `section` is what the rail lists and what the
// player bar names as "Now reading"; `heading` lines are the design's uppercase kickers
// (docs/features/overview-redesign.md), spoken in narration as the section's cue.
//
// `bullet` is a property of the note format rather than of the rendering: the README's
// note shape says Key points is a list of three to seven bullets, so the section that
// builds the lines decides, and the mark stays out of `text` — the spoken script and the
// word counts read that.
//
// `range` is the stretch of the video a line is about, for the reader to jump to; narration
// never reads it. A `footnote` is set small and muted, and is never a section's substance.
//
// `spoken` is what narration says for the line when it differs from what the reader shows,
// and an empty `spoken` is a line narration passes over (docs/features/tts-pre-rendered-speech.md).
import type { TimeRange } from "./WatchAnyway.js";

export interface NoteLine {
  section: string;
  heading: boolean;
  bullet: boolean;
  text: string;
  spoken?: string;
  range?: TimeRange;
  footnote?: boolean;
}
