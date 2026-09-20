import { formatTimestamp } from "../../../util/formatTimestamp.js";

// startMs/endMs come straight from YouTube's own caption timing (docs/architecture/v1-architecture-decisions.md:
// "the model reads an offset already present in its input"), never a model-estimated
// duration — formatting that real, already-measured data is fine even under
// docs/prototype/constraints.md's rule against a model fabricating a measurement.
export function formatTimeRange(startMs: number, endMs: number): string {
  return `${formatTimestamp(startMs)}–${formatTimestamp(endMs)}`;
}
