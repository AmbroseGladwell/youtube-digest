import { formatClock } from "./formatClock.js";

// Floors rather than rounds: a timestamp is a point you can jump to, and landing a
// moment early is harmless where landing a moment late cuts the first word off.
export function formatTimestamp(ms: number): string {
  return formatClock(Math.floor(ms / 1000));
}
