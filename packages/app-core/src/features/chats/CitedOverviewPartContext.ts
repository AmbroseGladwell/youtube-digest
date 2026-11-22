import { createContext, useContext } from "react";
import type { OverviewPart } from "@overview/domain";

// `index` is null once the item has changed; `followed` counts follows, so a repeat scrolls back to it.
export interface CitedOverviewPart {
  part: OverviewPart;
  index: number | null;
  followed: number;
}

export const CitedOverviewPartContext = createContext<CitedOverviewPart | null>(null);

export const useCitedOverviewPart = (): CitedOverviewPart | null => useContext(CitedOverviewPartContext);

const PARTS_TINTED_WHOLE: ReadonlySet<OverviewPart> = new Set(["verdict", "selling", "watchAnyway"]);

export const CITED_PART_SELECTOR = '[data-cited-part="true"]';

// The cited one is tinted by the global [data-cited-part] rule and can take focus (319n–319s).
export const citedPartProps = (cited: CitedOverviewPart | null, part: OverviewPart, index: number | "section") => {
  const isCited =
    cited !== null &&
    cited.part === part &&
    (PARTS_TINTED_WHOLE.has(part) || cited.index === index || (cited.index === null && index === "section"));
  return {
    "data-overview-part": part,
    "data-cited-part": isCited ? "true" : undefined,
    tabIndex: isCited ? -1 : undefined,
  };
};
