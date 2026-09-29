import { useEffect, useState, type RefCallback } from "react";
import { useCanFollowPlayback, usePlaybackPosition } from "../../../../app/PlaybackContext.js";
import type { TranscriptBlock } from "../../../transcripts/types/TranscriptBlock.js";
import { blockAtPosition } from "../../../transcripts/util/blockAtPosition.js";
import { scrollToRestingLine } from "./scrollToRestingLine.js";

export interface FollowPlayback {
  // -1 when the player has not reported, when the shell cannot see one, and before the
  // first block begins.
  currentBlockIndex: number;
  following: boolean;
  offered: boolean;
  currentRow: RefCallback<HTMLElement>;
  follow: () => void;
  stop: () => void;
}

// The transcript moves with the video the panel is beside, the block being spoken coming
// to rest under the sticky head rather than in the middle of the window, which on the
// panel is behind it (docs/features/following-playback.md).
export interface FollowPlaybackOptions {
  // True while a remembered reading position is about to be restored. The follow must
  // not scroll over it in the same frame, and it stays off afterwards until the reader
  // asks for it back (docs/features/reading-position.md).
  held?: boolean;
  // The panel's sticky head, which is what the block being spoken comes to rest under.
  head: HTMLElement | null;
}

export function useFollowPlayback(
  videoId: string | null,
  blocks: TranscriptBlock[],
  { held = false, head }: FollowPlaybackOptions,
): FollowPlayback {
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
}
