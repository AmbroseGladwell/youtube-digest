import type { Evidence, Overview } from "@overview/domain";

export interface QuotationCounts {
  quotations: number | undefined;
  quotationAsides: number | undefined;
}

// Counts only, never the words: how often a note quotes its source, and how often it says
// what a quotation adds (OV-216). Absent on a recipe note, which never quotes.
export function quotationCounts(overview: Overview): QuotationCounts {
  if (overview.recipe != null) return { quotations: undefined, quotationAsides: undefined };
  const evidence = [...overview.keyPoints.map((point) => point.evidence), overview.verdict?.standsOut?.evidence].filter(
    (quoted): quoted is Evidence => quoted !== undefined,
  );
  return { quotations: evidence.length, quotationAsides: evidence.filter((quoted) => quoted.adds !== null).length };
}
