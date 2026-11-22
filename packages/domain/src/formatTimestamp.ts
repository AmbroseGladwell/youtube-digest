import { formatClock } from "./formatClock.js";

// Floors: landing a moment late would cut the first word off.
export const formatTimestamp = (ms: number): string => {
  return formatClock(Math.floor(ms / 1000));
};
