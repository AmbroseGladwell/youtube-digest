// Design 310g–310h: the chat's sheet drags like iOS. Past either rest it resists, moving as
// overshoot^0.7; let go, it springs to the nearer rest unless flicked, when the flick wins.
export const FLICK_PX_PER_MS = 0.5;
export const LOWERED_SHOWS_PX = 66;

export type SheetRest = "raised" | "lowered";

// Where the sheet sits for a finger offset from the top of its travel, which runs from 0 (raised)
// to `travel` (lowered to its header).
export const resistedOffset = (offset: number, travel: number): number => {
  if (offset < 0) {
    return -(Math.abs(offset) ** 0.7);
  }
  if (offset > travel) {
    return travel + (offset - travel) ** 0.7;
  }
  return offset;
};

export const restAfterDrag = (offset: number, travel: number, velocityPxPerMs: number): SheetRest => {
  if (velocityPxPerMs > FLICK_PX_PER_MS) {
    return "lowered";
  }
  if (velocityPxPerMs < -FLICK_PX_PER_MS) {
    return "raised";
  }
  return offset > travel / 2 ? "lowered" : "raised";
};
