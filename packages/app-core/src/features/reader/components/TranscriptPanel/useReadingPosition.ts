import { useCallback, useEffect, useRef, useState, type RefCallback } from "react";
import {
  forgetReadingPosition,
  readReadingPosition,
  writeReadingPosition,
} from "../../../transcripts/readingPositionStorage.js";
import type { TranscriptBlock } from "../../../transcripts/types/TranscriptBlock.js";
import { blockAtPosition } from "../../../transcripts/util/blockAtPosition.js";

export interface ReadingPosition {
  // The block about to be scrolled back to, or -1: nothing remembered, the top, or a
  // chapter asked for somewhere else.
  restoredBlockIndex: number;
  restoredRow: RefCallback<HTMLElement>;
  rows: RefCallback<HTMLElement>;
  // Off while the transcript follows the video: a position the player chose is not one
  // to come back to, and turning it off forgets the one held
  // (docs/features/reading-position.md).
  setRemembering: (remembering: boolean) => void;
}

export function useReadingPosition(
  videoId: string | null,
  blocks: TranscriptBlock[],
  { ignored }: { ignored: boolean },
): ReadingPosition {
  const [remembered] = useState(() => (videoId === null ? null : readReadingPosition(videoId)));
  const [restoreDone, setRestoreDone] = useState(false);
  const [restoredRow, setRestoredRow] = useState<HTMLElement | null>(null);
  const rows = useRef<HTMLElement | null>(null);
  const rememberingNow = useRef(false);

  const rememberedIndex = remembered === null || ignored ? -1 : blockAtPosition(blocks, remembered);
  const restoredBlockIndex = restoreDone || rememberedIndex <= 0 ? -1 : rememberedIndex;

  useEffect(() => {
    if (restoredRow === null) {
      return;
    }
    restoredRow.scrollIntoView({ block: "center" });
    setRestoreDone(true);
  }, [restoredRow]);

  const setRemembering = useCallback(
    (remembering: boolean) => {
      rememberingNow.current = remembering;
      if (!remembering && videoId !== null) {
        forgetReadingPosition(videoId);
      }
    },
    [videoId],
  );

  // One measurement per frame at most, off the rows' own boxes; nothing here estimates
  // where the reader is from the scroll offset.
  useEffect(() => {
    if (videoId === null) {
      return;
    }
    let frame = 0;
    const save = () => {
      frame = 0;
      if (rows.current === null || !rememberingNow.current) {
        return;
      }
      const row = rowAtViewportCentre(rows.current);
      if (row === null || row.index === 0) {
        forgetReadingPosition(videoId);
      } else {
        writeReadingPosition(videoId, row.startMs);
      }
    };
    const onScroll = () => {
      if (frame === 0) {
        frame = requestAnimationFrame(save);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame !== 0) {
        cancelAnimationFrame(frame);
      }
    };
  }, [videoId]);

  return {
    restoredBlockIndex,
    restoredRow: setRestoredRow,
    rows: (element) => {
      rows.current = element;
    },
    setRemembering,
  };
}

function rowAtViewportCentre(container: HTMLElement): { index: number; startMs: number } | null {
  const centre = window.innerHeight / 2;
  let nearest: { index: number; startMs: number } | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  Array.from(container.children).forEach((child, index) => {
    const rect = child.getBoundingClientRect();
    const distance = rect.top > centre ? rect.top - centre : rect.bottom < centre ? centre - rect.bottom : 0;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = { index, startMs: Number((child as HTMLElement).dataset.startMs) };
    }
  });
  return nearest;
}
