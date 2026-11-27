import { createContext, useContext } from "react";
import type { SpokenAnswerPlace } from "@overview/domain";
import type { SentenceRange } from "../util/sentencePieces.js";
import type { SentenceOnScreen } from "./ReadAloudEngine.js";

// The answer being read aloud: every sentence's place, the one being read, and a way to move there (OV-428).
export interface ReadingAnswer {
  sentences: readonly SentenceOnScreen[];
  current: number | null;
  choose: (sentence: number) => void;
}

export interface BlockReading {
  ranges: SentenceRange[];
  current: number | null;
  choose: (sentence: number) => void;
}

const SpokenSentenceContext = createContext<ReadingAnswer | null>(null);

export const SpokenSentenceProvider = SpokenSentenceContext.Provider;

const samePlace = (a: SpokenAnswerPlace, b: SpokenAnswerPlace): boolean => JSON.stringify(a) === JSON.stringify(b);

// The sentences of the answer being read that sit in this block of this part of it.
export const useBlockReading = (place: SpokenAnswerPlace | undefined, block: number): BlockReading | null => {
  const reading = useContext(SpokenSentenceContext);
  if (reading === null || place === undefined) {
    return null;
  }
  const ranges = reading.sentences.flatMap((sentence, index) =>
    sentence.block === block && samePlace(sentence.place, place) ? [{ index, start: sentence.start, end: sentence.end }] : [],
  );
  return ranges.length === 0 ? null : { ranges, current: reading.current, choose: reading.choose };
};
