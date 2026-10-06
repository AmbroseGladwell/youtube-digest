import { NOVELTY_BASIS } from "./noveltyLabel.js";
import type { SharedNote } from "./SharedNote.js";

// Text that belongs to a section but is never a line of it: shown after the section's last
// line, never tapped, tinted, spoken or timed (docs/features/novelty-scale.md, "What it is
// judged against").
export function overviewNoteCaptions(overview: SharedNote): Record<string, string> {
  return overview.verdict ? { Verdict: NOVELTY_BASIS } : {};
}
