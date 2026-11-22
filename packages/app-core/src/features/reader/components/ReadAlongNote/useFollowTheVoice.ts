import { useEffect, useState, type RefCallback } from "react";

export interface FollowTheVoice {
  following: boolean;
  offered: boolean;
  spokenLine: RefCallback<HTMLElement>;
  follow: () => void;
}

// Why a resting line is left alone: docs/features/stone-theme.md, "Highlighting".
const TOP_THIRD = 1 / 3;
const LOWEST_RESTING = 0.45;

// Why instant, not smooth: docs/features/audio-player.md, "The note follows the voice".
const keepInTopThird = (line: HTMLElement) => {
  const rect = line.getBoundingClientRect();
  const stickyTop = parseFloat(getComputedStyle(line).scrollMarginTop) || 0;
  const viewport = window.innerHeight;
  const resting = rect.top >= stickyTop && rect.top <= viewport * LOWEST_RESTING && rect.bottom < viewport - viewport * TOP_THIRD;
  if (resting) {
    return;
  }
  line.scrollIntoView({ block: "start", behavior: "instant" });
};

// Silent, following, scrolled away: docs/features/audio-player.md, "The note follows the voice".
export const useFollowTheVoice = (speaking: boolean): FollowTheVoice => {
  const [wanted, setWanted] = useState(true);
  const [spokenLine, setSpokenLine] = useState<HTMLElement | null>(null);
  const following = speaking && wanted;

  useEffect(() => {
    if (!following || spokenLine === null) {
      return;
    }
    keepInTopThird(spokenLine);
  }, [following, spokenLine]);

  // The spoken line leaving the screen means the reader took over; a scroll listener can't tell whose.
  useEffect(() => {
    if (!following || spokenLine === null) {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => !entry.isIntersecting)) {
        setWanted(false);
      }
    });
    observer.observe(spokenLine);
    return () => observer.disconnect();
  }, [following, spokenLine]);

  return {
    following,
    offered: speaking && !wanted,
    spokenLine: setSpokenLine,
    follow: () => setWanted(true),
  };
};
