import type { TranscriptBlock } from "@overview/domain";
import { useCallback, useEffect, useRef, useState, type RefCallback } from "react";
import { forgetReadingPosition, readReadingPosition, writeReadingPosition } from "../../../transcripts/readingPositionStorage.js";
import { blockAtPosition } from "../../../transcripts/util/blockAtPosition.js";
import { useLibraryAccountId } from "../../../../stores/LibraryAccountContext.js";
import { scrollToRestingLine } from "./scrollToRestingLine.js";
import { transcriptRestingLine } from "./transcriptRestingLine.js";

export interface ReadingPosition {
  restoredBlockIndex: number;
  restoredRow: RefCallback<HTMLElement>;
  rows: RefCallback<HTMLElement>;
  // Off while following: docs/features/reading-position.md, "Restoring, and the follow".
  setRemembering: (remembering: boolean) => void;
}

export interface UseReadingPositionOptions {
  ignored: boolean;
  head: HTMLElement | null;
}

export const useReadingPosition = (
  videoId: string | null,
  blocks: TranscriptBlock[],
  { ignored, head }: UseReadingPositionOptions,
): ReadingPosition => {
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

  // At most one measurement a frame, off the rows' own boxes, never estimated from the scroll offset.
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
};

interface RestingRow {
  index: number;
  startMs: number;
}

const WHOLE_DEVICE_PIXEL_TOLERANCE = 1;

// The first row to start at the line, not the nearest: one half behind the head isn't being read.
const rowAtRestingLine = (container: HTMLElement, line: number): RestingRow | null => {
  const rows = Array.from(container.children);
  const found = rows.findIndex((child) => child.getBoundingClientRect().top >= line - WHOLE_DEVICE_PIXEL_TOLERANCE);
  const index = found === -1 ? rows.length - 1 : found;
  const row = rows[index];
  return row === undefined ? null : { index, startMs: Number((row as HTMLElement).dataset.startMs) };
};
