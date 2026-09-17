// startMs/endMs come straight from Supadata's own caption timing (docs/architecture/v1-architecture-decisions.md:
// "the model reads an offset already present in its input"), never a model-estimated
// duration — formatting that real, already-measured data is fine even under
// docs/prototype/constraints.md's rule against a model fabricating a measurement.
function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedSeconds = String(seconds).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${paddedSeconds}`;
  }
  return `${minutes}:${paddedSeconds}`;
}

export function formatTimeRange(startMs: number, endMs: number): string {
  return `${formatMs(startMs)}–${formatMs(endMs)}`;
}
