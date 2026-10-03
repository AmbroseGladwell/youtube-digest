import type { LibraryMove } from "../types/LibraryMove.js";
import { overviewsNoun } from "./libraryPlace.js";

export interface LibraryMoveCopy {
  lead: string;
  then: string | null;
}

const keptExisting = (count: number): string =>
  `so we kept your existing ${count === 1 ? "version" : "versions"}`;

// Designs 47e-1 and 47e-2: "added" only ever when something was.
export function libraryMoveCopy({ moved, alreadyThere }: LibraryMove): LibraryMoveCopy {
  if (moved === 0) {
    return {
      lead: `${alreadyThere} ${overviewsNoun(alreadyThere)} ${alreadyThere === 1 ? "was" : "were"} already in your account, ${keptExisting(alreadyThere)}.`,
      then: null,
    };
  }
  return {
    lead: `${moved} ${overviewsNoun(moved)} added to your account.`,
    then:
      alreadyThere === 0
        ? null
        : `${alreadyThere} ${alreadyThere === 1 ? "was" : "were"} already there, ${keptExisting(alreadyThere)}.`,
  };
}
