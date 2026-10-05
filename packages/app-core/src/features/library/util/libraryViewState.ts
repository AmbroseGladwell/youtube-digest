import type { LibraryView } from "../types/LibraryView.js";
import { parseLibraryView } from "./libraryFilterParams.js";

export interface LibraryViewState {
  libraryView: string;
  kept: string[];
}

export interface SteppedLibraryView {
  view: LibraryView;
  kept: ReadonlySet<string>;
  stepOn: (overviewId: string) => LibraryViewState;
}

// Carried in history state from the list to the reader, so Previous and Next walk the list
// the reader opened it from, with every overview already passed kept in it
// (docs/features/library-view.md, "The reader steps through it").
export function libraryViewState(searchParams: URLSearchParams, kept: Iterable<string> = []): LibraryViewState {
  return { libraryView: searchParams.toString(), kept: [...new Set(kept)] };
}

export function libraryViewFromState(state: unknown): SteppedLibraryView | null {
  if (typeof state !== "object" || state === null) return null;
  const { libraryView, kept } = state as { libraryView?: unknown; kept?: unknown };
  if (typeof libraryView !== "string") return null;
  const keptIds = Array.isArray(kept) ? kept.filter((id): id is string => typeof id === "string") : [];
  return {
    view: parseLibraryView(new URLSearchParams(libraryView)),
    kept: new Set(keptIds),
    stepOn: (overviewId) => ({ libraryView, kept: [...new Set([...keptIds, overviewId])] }),
  };
}
