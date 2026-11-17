import { createContext, useContext } from "react";
import type { OverviewPart } from "@overview/domain";

// The part of the overview a chat answer's citation was followed to, or its section alone when
// the item has since changed (index null). `followed` counts follows, so following the same
// part again brings it back into view.
export interface CitedOverviewPart {
  part: OverviewPart;
  index: number | null;
  followed: number;
}

export const CitedOverviewPartContext = createContext<CitedOverviewPart | null>(null);

export const useCitedOverviewPart = (): CitedOverviewPart | null => useContext(CitedOverviewPartContext);

// The verdict, What it's selling and Watch it anyway are tinted whole (design 319p).
const WHOLE_BLOCK: ReadonlySet<OverviewPart> = new Set(["verdict", "selling", "watchAnyway"]);

export const CITED_PART_SELECTOR = '[data-cited-part="true"]';

// Marks an element as a part an answer can lead to: one item, or its section's heading. The
// cited one is tinted by the global [data-cited-part] rule and can take focus (319n–319s).
export function citedPartProps(cited: CitedOverviewPart | null, part: OverviewPart, index: number | "section") {
  const isCited =
    cited !== null &&
    cited.part === part &&
    (WHOLE_BLOCK.has(part) || cited.index === index || (cited.index === null && index === "section"));
  return {
    "data-overview-part": part,
    "data-cited-part": isCited ? "true" : undefined,
    tabIndex: isCited ? -1 : undefined,
  };
}
