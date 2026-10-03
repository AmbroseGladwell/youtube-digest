import type { TranscriptBlock } from "@overview/domain";
import { useCallback, useEffect, useRef, useState, type RefCallback } from "react";
import {
  forgetReadingPosition,
  readReadingPosition,
  writeReadingPosition,
} from "../../../transcripts/readingPositionStorage.js";
import { blockAtPosition } from "../../../transcripts/util/blockAtPosition.js";
import { useLibraryAccountId } from "../../../../stores/LibraryAccountContext.js";
import { scrollToRestingLine } from "./scrollToRestingLine.js";
import { transcriptRestingLine } from "./transcriptRestingLine.js";

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
  { ignored, head }: { ignored: boolean; head: HTMLElement | null },
): ReadingPosition {
  const accountId = useLibraryAccountId();
  const [remembered] = useState(() => (videoId === null ? null : readReadingPosition(videoId, accountId)));
  const [restoreDone, setRestoreDone] = useState(false);
  const [restoredRow, setRestoredRow] = useState<HTMLElement | null>(null);
  const rows = useRef<HTMLElement | null>(null);
  const rememberingNow = useRef(false);

  const rememberedIndex = remembered === null || ignored ? -1 : blockAtPosition(blocks, remembered);
  const restoredBlockIndex = restoreDone || rememberedIndex <= 0 ? -1 : rememberedIndex;

  useEffect(() => {
    if (restoredRow === null || head === null) {
      return;
    }
    scrollToRestingLine(restoredRow, head);
    setRestoreDone(true);
  }, [restoredRow, head]);

  const setRemembering = useCallback(
    (remembering: boolean) => {
      rememberingNow.current = remembering;
      if (!remembering && videoId !== null) {
        forgetReadingPosition(videoId, accountId);
      }
    },
    [videoId, accountId],
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
      if (rows.current === null || head === null || !rememberingNow.current) {
        return;
      }
      const row = rowAtRestingLine(rows.current, transcriptRestingLine(head));
      if (row === null || row.index === 0) {
        forgetReadingPosition(videoId, accountId);
      } else {
        writeReadingPosition(videoId, row.startMs, accountId);
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
  }, [videoId, head, accountId]);

  return {
    restoredBlockIndex,
    restoredRow: setRestoredRow,
    rows: (element) => {
      rows.current = element;
    },
    setRemembering,
  };
}

// The line a block is put back on is the line one is read off, so a restore does not then
// remember a different block than the one it restored. The block you are on is the first
// one to start at the line rather than the nearest to it: a block still half behind the
// head is not the one being read. A pixel of tolerance, because the scroll that put it
// there lands on whole device pixels.
function rowAtRestingLine(
  container: HTMLElement,
  line: number,
): { index: number; startMs: number } | null {
  const rows = Array.from(container.children);
  const found = rows.findIndex((child) => child.getBoundingClientRect().top >= line - 1);
  const index = found === -1 ? rows.length - 1 : found;
  const row = rows[index];
  return row === undefined ? null : { index, startMs: Number((row as HTMLElement).dataset.startMs) };
}
