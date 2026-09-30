import { useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { Routes } from "../../../../app/Routes.js";
import { PlayPauseIcon } from "../../../../components/shared/PlayPauseIcon/PlayPauseIcon.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { formatClock } from "../../../../util/formatClock.js";
import { useShouldAnimateNavigation } from "../../../../util/viewTransitions.js";
import { usePlayer, usePlayerSnapshot, usePlayerTime } from "../../PlayerContext.js";
import { SKIP_SECONDS } from "../../PlayerEngine.js";
import type { PlayerSnapshot } from "../../types/PlayerSnapshot.js";
import { lineAtTime } from "../../util/lineAtTime.js";
import { sectionHeadingAt } from "../../util/playerBarView.js";
import styles from "./MiniPlayer.module.scss";
import { miniPlayerTestIds } from "./MiniPlayerTestIds.js";

const CLEARANCE_PROPERTY = "--mini-player-clearance";
const CLEARANCE_GAP_PX = 8;

const DOCKED_STATUSES = new Set<PlayerSnapshot["status"]>(["preparing", "playing", "paused", "buffering"]);

// Design 3a: leaving a note that is playing docks this at the foot of every page — title,
// section and clock, the transport, and × to stop. It is absent on the playing note's own
// reader, whose bar already says all of it (docs/features/audio-player.md).
export function MiniPlayer() {
  const engine = usePlayer();
  const snapshot = usePlayerSnapshot();
  const { pathname } = useLocation();
  const { track } = snapshot;
  const shown =
    track !== null && DOCKED_STATUSES.has(snapshot.status) && pathname !== Routes.overview(track.overviewId);

  if (!shown) return null;
  return <DockedMiniPlayer snapshot={snapshot} onStop={() => engine.stop()} />;
}

function DockedMiniPlayer({ snapshot, onStop }: { snapshot: PlayerSnapshot; onStop: () => void }) {
  const engine = usePlayer();
  const time = usePlayerTime();
  const animateNavigation = useShouldAnimateNavigation();
  const root = useRef<HTMLDivElement | null>(null);
  const [artworkFailed, setArtworkFailed] = useState(false);
  const track = snapshot.track!;
  const { timings, status, source } = snapshot;
  const estimated = source === "pacer" ? "~" : "";
  const section = sectionHeadingAt(track.lines, lineAtTime(timings.lineStarts, time));
  const percent = timings.durationSeconds > 0 ? (time / timings.durationSeconds) * 100 : 0;
  const playing = status === "playing" || status === "buffering";
  const preparing = status === "preparing";

  // How much of the window's foot this covers, so a reader's own bar and the last row of
  // a page can sit above it rather than under it.
  useLayoutEffect(() => {
    const element = root.current;
    if (element === null) return;
    const publish = () => {
      const clearance = window.innerHeight - element.getBoundingClientRect().top + CLEARANCE_GAP_PX;
      document.documentElement.style.setProperty(CLEARANCE_PROPERTY, `${Math.max(0, clearance)}px`);
    };
    publish();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(publish);
    observer?.observe(element);
    window.addEventListener("resize", publish);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", publish);
      document.documentElement.style.removeProperty(CLEARANCE_PROPERTY);
    };
  }, []);

  return (
    <div className={styles.root} role="region" aria-label="Now playing" ref={root} data-testid={miniPlayerTestIds.root}>
      <div className={styles.row}>
        {track.artworkUrl !== null && !artworkFailed ? (
          <img className={styles.artwork} src={track.artworkUrl} alt="" onError={() => setArtworkFailed(true)} />
        ) : (
          <span className={styles.artwork} aria-hidden="true" />
        )}
        <Link
          className={styles.title}
          to={Routes.overview(track.overviewId)}
          viewTransition={animateNavigation}
          data-testid={miniPlayerTestIds.titleLink}
        >
          <span className={styles.titleText}>{track.title}</span>
          <span className={styles.meta} data-testid={miniPlayerTestIds.meta}>
            {preparing
              ? "Preparing audio"
              : `${section} · ${estimated}${formatClock(time)} / ${estimated}${formatClock(timings.durationSeconds)}`}
          </span>
        </Link>
        <button
          type="button"
          className={styles.step}
          onClick={() => engine.skip(-SKIP_SECONDS)}
          disabled={preparing}
          aria-label={`Back ${SKIP_SECONDS} seconds`}
        >
          <StrokeIcon name="rotateCcw" size={16} />
        </button>
        <button
          type="button"
          className={styles.play}
          onClick={() => engine.toggle()}
          aria-label={preparing ? "Cancel preparing audio" : playing ? "Pause" : "Play"}
          data-testid={miniPlayerTestIds.playButton}
        >
          {preparing ? (
            <span className={styles.spinner}>
              <StrokeIcon name="loader" size={16} />
            </span>
          ) : (
            <PlayPauseIcon playing={playing} />
          )}
        </button>
        <button
          type="button"
          className={styles.step}
          onClick={() => engine.skip(SKIP_SECONDS)}
          disabled={preparing}
          aria-label={`Forward ${SKIP_SECONDS} seconds`}
        >
          <StrokeIcon name="rotateCw" size={16} />
        </button>
        <button
          type="button"
          className={styles.step}
          onClick={onStop}
          aria-label="Stop and close"
          data-testid={miniPlayerTestIds.closeButton}
        >
          <StrokeIcon name="close" size={16} />
        </button>
      </div>
      <span className={styles.progress} aria-hidden="true">
        <span
          className={`${styles.progressFill} ${source === "pacer" ? styles.progressStone : ""}`}
          style={{ width: `${percent}%` }}
        />
      </span>
    </div>
  );
}
