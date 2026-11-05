export type HistoryMove = "PUSH" | "REPLACE" | "POP";

export interface HistoryEntry {
  key: string;
  pathname: string;
}

// The entries this session has walked, and where in them the reader is now. The router
// only tells us the current location and how it was reached, so what lies behind it is
// kept here (docs/features/back-within-reach.md, "Back in history, or home").
export interface HistoryTrail {
  entries: readonly HistoryEntry[];
  index: number;
}

export const EMPTY_HISTORY_TRAIL: HistoryTrail = { entries: [], index: -1 };

export function advanceHistoryTrail(trail: HistoryTrail, move: HistoryMove, entry: HistoryEntry): HistoryTrail {
  switch (move) {
    case "PUSH":
      return { entries: [...trail.entries.slice(0, trail.index + 1), entry], index: trail.index + 1 };
    case "REPLACE":
      return trail.index < 0
        ? { entries: [entry], index: 0 }
        : { entries: trail.entries.map((known, index) => (index === trail.index ? entry : known)), index: trail.index };
    case "POP": {
      const index = trail.entries.findIndex((known) => known.key === entry.key);
      return index < 0 ? { entries: [...trail.entries, entry], index: trail.entries.length } : { ...trail, index };
    }
  }
}

export function previousPathname(trail: HistoryTrail): string | null {
  return trail.entries[trail.index - 1]?.pathname ?? null;
}
