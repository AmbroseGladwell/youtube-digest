import type { Overview } from "@overview/domain";

// A count only, never the words: how often a note quotes its source (OV-216). Absent on a
// recipe note, which never quotes.
export function quotationCounts(overview: Overview): { quotations: number | undefined } {
  if (overview.recipe != null) return { quotations: undefined };
  const quoted = [...overview.keyPoints.map((point) => point.evidence), overview.verdict?.standsOut?.evidence];
  return { quotations: quoted.filter((evidence) => evidence !== undefined).length };
}
