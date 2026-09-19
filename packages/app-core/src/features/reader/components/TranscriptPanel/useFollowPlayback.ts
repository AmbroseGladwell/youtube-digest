import { useEffect, useState, type RefCallback } from "react";
import { useCanFollowPlayback, usePlaybackPosition } from "../../../../app/PlaybackContext.js";
import type { TranscriptBlock } from "../../../transcripts/types/TranscriptBlock.js";
import { blockAtPosition } from "../../../transcripts/util/blockAtPosition.js";

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

// The transcript moves with the video the panel is beside. Scrolling is instant rather
// than smooth on purpose: the observer below treats the current row leaving the viewport
// as the reader taking over, and a scroll still in flight would trip it
// (docs/features/following-playback.md).
export function useFollowPlayback(
  videoId: string | null,
  blocks: TranscriptBlock[],
): FollowPlayback {
  const canFollow = useCanFollowPlayback();
  const position = usePlaybackPosition(videoId);
  const [following, setFollowing] = useState(true);
  const [currentRow, setCurrentRow] = useState<HTMLElement | null>(null);

  const reporting = position !== null;
  const currentBlockIndex = position === null ? -1 : blockAtPosition(blocks, position.positionMs);

  useEffect(() => {
    if (!following || currentRow === null) {
      return;
    }
    currentRow.scrollIntoView({ block: "center" });
  }, [following, currentRow]);

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
