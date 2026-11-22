import { OVERVIEW_PARTS, type OverviewPartCitation } from "@overview/domain";

// The item of an overview a chat answer cited, when the reader followed the citation here from
// another overview's chat or the Ask page (OV-362), carried in the link's state.
export const CITED_PLACE_STATE = "citedPlace";

export const citedPlaceFromLocation = (state: unknown): OverviewPartCitation | null => {
  if (typeof state !== "object" || state === null) {
    return null;
  }
  const place = (state as Record<string, unknown>)[CITED_PLACE_STATE] as Partial<OverviewPartCitation> | undefined;
  if (place === undefined || place === null) {
    return null;
  }
  const { part, index, textHash } = place;
  if (typeof part !== "string" || !(OVERVIEW_PARTS as readonly string[]).includes(part)) {
    return null;
  }
  if (typeof index !== "number" || typeof textHash !== "string") {
    return null;
  }
  return { part: part as OverviewPartCitation["part"], index, textHash };
};
