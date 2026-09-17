// One tappable line of the read-along body. `section` is what the rail lists and what the
// player bar names as "Now reading"; `heading` lines are the design's uppercase kickers
// and are stepped past rather than read (docs/features/overview-redesign.md).
export interface NoteLine {
  section: string;
  heading: boolean;
  text: string;
}
