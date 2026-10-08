import { useEffect, useState, type RefCallback } from "react";

export interface FollowTheVoice {
  following: boolean;
  // The way back, drawn only once the reader has taken the scroll over.
  offered: boolean;
  spokenLine: RefCallback<HTMLElement>;
  follow: () => void;
}

// Design 1a: the page scrolls to keep the sentence being read in the top third. A line
// already resting there is left alone, so a listener who has not touched the page sees
// the tint walk down and the page catch up, never a jump per sentence
// (docs/features/stone-theme.md, "Highlighting").
const TOP_THIRD = 1 / 3;
const LOWEST_RESTING = 0.45;

// Instant rather than smooth, for the reason the transcript's is
// (docs/features/following-playback.md): the scroll away that hands the page back is
// read off the spoken line leaving the window, and a scroll still in flight is a line
// off the window on its way to being on it.
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

// The note moves with the voice, and only with the voice (docs/features/audio-player.md,
// "The note follows the voice"). A note opened in silence stays where it was opened —
// which it did not: every open scrolled the page down to the premise before the reader
// had asked for anything, and that is the bug this is.
export function useFollowTheVoice(speaking: boolean): FollowTheVoice {
  const [wanted, setWanted] = useState(true);
  const [spokenLine, setSpokenLine] = useState<HTMLElement | null>(null);
  const following = speaking && wanted;

  useEffect(() => {
    if (!following || spokenLine === null) {
      return;
    }
    keepInTopThird(spokenLine);
  }, [following, spokenLine]);

  // Reading ahead, or back, is the reader taking the scroll over, so the following stands
  // down and the way back is offered instead — the transcript's rule, asked the same
  // narrow question of the line being spoken: is it still on screen. A scroll listener
  // could not tell our scroll from theirs; this does not have to
  // (docs/features/following-playback.md).
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
}
