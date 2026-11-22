import type { TranscriptBlock } from "@overview/domain";
import { useEffect, useState, type RefCallback } from "react";
import { useCanFollowPlayback, usePlaybackPosition } from "../../../../app/PlaybackContext.js";
import { blockAtPosition } from "../../../transcripts/util/blockAtPosition.js";
import { scrollToRestingLine } from "./scrollToRestingLine.js";

export interface FollowPlayback {
  // -1 when the player hasn't reported, the shell can't see one, or before the first block.
  currentBlockIndex: number;
  following: boolean;
  offered: boolean;
  currentRow: RefCallback<HTMLElement>;
  follow: () => void;
  stop: () => void;
}

export interface FollowPlaybackOptions {
  // While a restore is pending: docs/features/reading-position.md, "Restoring, and the follow".
  held?: boolean;
  head: HTMLElement | null;
}

export const useFollowPlayback = (
  videoId: string | null,
  blocks: TranscriptBlock[],
  { held = false, head }: FollowPlaybackOptions,
): FollowPlayback => {
  const canFollow = useCanFollowPlayback();
  const position = usePlaybackPosition(videoId);
  const [wanted, setFollowing] = useState(true);
  const [currentRow, setCurrentRow] = useState<HTMLElement | null>(null);
  const following = wanted && !held;

  useEffect(() => {
    if (held) {
      setFollowing(false);
    }
  }, [held]);

  const reporting = position !== null;
  const currentBlockIndex = position === null ? -1 : blockAtPosition(blocks, position.positionMs);

  useEffect(() => {
    if (!following || currentRow === null || head === null) {
      return;
    }
    scrollToRestingLine(currentRow, head);
  }, [following, currentRow, head]);

  useEffect(() => {
    if (!following || currentRow === null) {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => !entry.isIntersecting)) {
        setFollowing(false);
      }
    });
    observer.observe(currentRow);
    return () => observer.disconnect();
  }, [following, currentRow]);

  return {
    currentBlockIndex,
    following: following && reporting,
    offered: canFollow && reporting && !following,
    currentRow: setCurrentRow,
    follow: () => setFollowing(true),
    stop: () => setFollowing(false),
  };
};
