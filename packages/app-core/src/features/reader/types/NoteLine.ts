// One tappable line of the read-along body. `section` is what the rail lists and what the
// player bar names as "Now reading"; `heading` lines are the design's uppercase kickers
// and are stepped past rather than read (docs/features/overview-redesign.md).
//
// `bullet` is a property of the note format rather than of the rendering: the README's
// note shape says Key points is a list of three to five bullets, so the section that
// builds the lines decides, and the mark stays out of `text` — the spoken script and the
// word counts read that.
export interface NoteLine {
  section: string;
  heading: boolean;
  bullet: boolean;
  text: string;
}
