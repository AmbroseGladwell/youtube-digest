import { useEffect, useRef, useState, type CSSProperties } from "react";
import { formatTimestamp, openPodcastLabel, type PodcastSource } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { BACK_SECONDS, FORWARD_SECONDS, type EpisodeEngine } from "../../episode/EpisodeEngine.js";
import { useEpisodeSnapshot } from "../../episode/useEpisodeEngine.js";
import { JUMP_LINE, JUMP_LINE_SHOWN_MS } from "../../episode/jumpLine.js";
import styles from "./EpisodePlayer.module.scss";
import { episodePlayerTestIds } from "./EpisodePlayerTestIds.js";

export interface EpisodePlayerProps {
  engine: EpisodeEngine;
  source: PodcastSource;
}

// Design 106p: a quiet strip under the head, in a podcast app's order: back 15, Play, forward
// 30, then where it is, its length and the scrubber, in stone so it never reads as Listen.
// After a time in the note moves it, and only then, one line says the jump may land early.
export function EpisodePlayer({ engine, source }: EpisodePlayerProps) {
  const { status, positionMs, durationMs, jumps } = useEpisodeSnapshot(engine);
  const lengthMs = durationMs ?? source.durationMs;
  const playing = status === "playing";
  const jumpLine = useJumpLine(jumps);

  return (
    <section className={styles.root} aria-label="The episode" data-testid={episodePlayerTestIds.root}>
      <span className={styles.label}>Episode audio</span>
      <div className={styles.strip}>
        <button
          type="button"
          className={styles.skip}
          onClick={() => engine.skip(-BACK_SECONDS)}
          aria-label={`Back ${BACK_SECONDS} seconds`}
          data-testid={episodePlayerTestIds.backButton}
        >
          <StrokeIcon name="rotateCcw" size={16} />
        </button>
        <button
          type="button"
          className={styles.play}
          onClick={() => engine.toggle()}
          aria-label={playing ? "Pause the episode" : "Play the episode"}
          data-testid={episodePlayerTestIds.playButton}
        >
          <StrokeIcon name={playing ? "pause" : "play"} size={16} />
        </button>
        <button
          type="button"
          className={styles.skip}
          onClick={() => engine.skip(FORWARD_SECONDS)}
          aria-label={`Forward ${FORWARD_SECONDS} seconds`}
          data-testid={episodePlayerTestIds.forwardButton}
        >
          <StrokeIcon name="rotateCw" size={16} />
        </button>
        <span className={styles.track}>
          <span className={styles.times}>
            <span data-testid={episodePlayerTestIds.position}>{formatTimestamp(positionMs)}</span>
            {lengthMs !== null && <span data-testid={episodePlayerTestIds.length}>{formatTimestamp(lengthMs)}</span>}
          </span>
          {lengthMs !== null && (
            <input
              type="range"
              className={styles.scrubber}
              min={0}
              max={Math.round(lengthMs / 1000)}
              step={1}
              value={Math.min(Math.round(positionMs / 1000), Math.round(lengthMs / 1000))}
              onChange={(event) => engine.seek(Number(event.currentTarget.value) * 1000)}
              aria-label="Where in the episode"
              aria-valuetext={`${formatTimestamp(positionMs)} of ${formatTimestamp(lengthMs)}`}
              style={{ "--played": `${Math.min(100, (positionMs / lengthMs) * 100)}%` } as CSSProperties}
              data-testid={episodePlayerTestIds.scrubber}
            />
          )}
        </span>
      </div>
      {status === "failed" ? (
        <p className={styles.failed} role="alert" data-testid={episodePlayerTestIds.failed}>
          The episode’s audio didn’t play here.{" "}
          <a href={source.sharedFrom} target="_blank" rel="noopener">
            {openPodcastLabel(source.sharedFrom)}
          </a>
        </p>
      ) : (
        <>
          <span
            className={`${styles.jumpLine} ${jumpLine.shown ? styles.jumpLineShown : ""}`}
            aria-hidden="true"
            data-testid={episodePlayerTestIds.jumpLine}
          >
            {JUMP_LINE}
          </span>
          {/* Heard once per note, as a polite status, not on every jump. */}
          <span className={styles.announcement} role="status">
            {jumpLine.announced ? JUMP_LINE : ""}
          </span>
        </>
      )}
    </section>
  );
}

// Shown for six seconds after each jump; another jump starts the six seconds again.
function useJumpLine(jumps: number): { shown: boolean; announced: boolean } {
  const [shown, setShown] = useState(false);
  const [announced, setAnnounced] = useState(false);
  const first = useRef(jumps);
  useEffect(() => {
    if (jumps === first.current) return;
    setShown(true);
    setAnnounced(true);
    const hide = window.setTimeout(() => setShown(false), JUMP_LINE_SHOWN_MS);
    return () => window.clearTimeout(hide);
  }, [jumps]);
  return { shown, announced };
}
