import { useMemo, useState } from "react";
import type { TranscriptBlock } from "../../../transcripts/types/TranscriptBlock.js";
import type { TranscriptMatch } from "../../../transcripts/types/TranscriptMatch.js";
import { transcriptMatches } from "../../../transcripts/util/transcriptMatches.js";

export interface TranscriptSearch {
  query: string;
  matches: TranscriptMatch[];
  currentIndex: number;
  setQuery: (query: string) => void;
  step: (delta: number) => void;
  matchesInBlock: (blockIndex: number) => TranscriptMatch[];
}

export function useTranscriptSearch(blocks: TranscriptBlock[]): TranscriptSearch {
  const [query, setQueryState] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  const matches = useMemo(() => transcriptMatches(blocks, query), [blocks, query]);
  const byBlock = useMemo(() => {
    const grouped = new Map<number, TranscriptMatch[]>();
    for (const match of matches) {
      const existing = grouped.get(match.blockIndex);
      if (existing) existing.push(match);
      else grouped.set(match.blockIndex, [match]);
    }
    return grouped;
  }, [matches]);

  return {
    query,
    matches,
    currentIndex: matches.length === 0 ? -1 : Math.min(currentIndex, matches.length - 1),
    setQuery: (next) => {
      setQueryState(next);
      setCurrentIndex(0);
    },
    // Wraps, because the counter reads "4/4" and the only thing left to offer there is
    // the first one again.
    step: (delta) =>
      setCurrentIndex((index) =>
        matches.length === 0 ? 0 : (index + delta + matches.length) % matches.length,
      ),
    matchesInBlock: (blockIndex) => byBlock.get(blockIndex) ?? [],
  };
}
