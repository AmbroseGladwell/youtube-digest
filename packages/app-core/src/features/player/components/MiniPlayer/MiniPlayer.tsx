import { formatClock } from "@overview/domain";
import { useState } from "react";
import { useLocation } from "react-router";
import { Routes } from "../../../../app/Routes.js";
import { PlayPauseIcon } from "../../../../components/shared/PlayPauseIcon/PlayPauseIcon.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { usePlayer, usePlayerSnapshot, usePlayerTime } from "../../PlayerContext.js";
import { SKIP_SECONDS } from "../../PlayerEngine.js";
import type { PlayerSnapshot } from "../../types/PlayerSnapshot.js";
import { lineAtTime } from "../../util/lineAtTime.js";
import { playerBarView, sectionHeadingAt, type PlayerBarView } from "../../util/playerBarView.js";
import { useReadAloudSnapshot } from "../../../chats/readAloud/ReadAloudContext.js";
import styles from "./MiniPlayer.module.scss";
import { miniPlayerTestIds } from "./MiniPlayerTestIds.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { useCookingTimerList } from "../../../cookingTimers/CookingTimersContext.js";

const DOCKED_STATUSES = new Set<PlayerSnapshot["status"]>(["preparing", "playing", "paused", "buffering"]);

// When it shows: docs/features/audio-player.md, "Which note the bar is about".
export const MiniPlayer = () => {
  const engine = usePlayer();
  const snapshot = usePlayerSnapshot();
  const { pathname } = useLocation();
  const { track } = snapshot;
  const shown = track !== null && snapshot.docked && DOCKED_STATUSES.has(snapshot.status) && pathname !== Routes.overview(track.overviewId);

  if (!shown) {
    return null;
  }
  return <DockedMiniPlayer snapshot={snapshot} onStop={() => engine.stop()} />;
};

// Design 42f: the bar's own words while it starts or waits past the render.
const metaText = (
  view: PlayerBarView,
  status: PlayerSnapshot["status"],
  waiting: boolean,
  pausedFor: "timer" | "chatAnswer" | null,
  clock: string,
): string => {
  if (status === "preparing" || waiting) {
    return view.label.rest === null ? view.label.lead : `${view.label.lead} · ${view.label.rest}`;
  }
  if (pausedFor === null) {
    return clock;
  }
  return pausedFor === "timer" ? "Paused for the timer" : "Paused for the chat answer";
};

const pausedForOf = (status: PlayerSnapshot["status"], timer: boolean, answer: boolean): "timer" | "chatAnswer" | null => {
  if (status !== "paused") {
    return null;
  }
  if (timer) {
    return "timer";
  }
  return answer ? "chatAnswer" : null;
};

const mainLabel = (view: PlayerBarView, status: PlayerSnapshot["status"]): string => {
  if (status === "preparing" || status === "buffering") {
    return view.main.label;
  }
  return status === "playing" ? "Pause" : "Play";
};

interface DockedMiniPlayerProps {
  snapshot: PlayerSnapshot;
  onStop: () => void;
}

const DockedMiniPlayer = ({ snapshot, onStop }: DockedMiniPlayerProps) => {
  const engine = usePlayer();
  const time = usePlayerTime();
  const analytics = useAnalytics();
  const { narrationHeld } = useCookingTimerList();
  const heldForAnswer = useReadAloudSnapshot()?.heldNarration === true;
  const [artworkFailed, setArtworkFailed] = useState(false);
  const track = snapshot.track!;
  const { timings, status, source } = snapshot;
  const estimated = source === "pacer" ? "~" : "";
  const section = sectionHeadingAt(track.lines, lineAtTime(timings.lineStarts, time));
  const view = playerBarView(snapshot, time, { read: false });
  const made = view.track.made;
  const waiting = snapshot.stream?.holdingLine != null;
  const played = timings.durationSeconds > 0 ? (time / timings.durationSeconds) * 100 : 0;
  const percent = waiting && made !== undefined ? Math.min(played, made) : played;
  const playing = status === "playing" || status === "buffering";
  const preparing = status === "preparing";
  const length = snapshot.stream === null ? `${estimated}${formatClock(timings.durationSeconds)}` : view.clock.end;

  return (
    <div className={styles.root} role="region" aria-label="Now playing" data-testid={miniPlayerTestIds.root}>
      <div className={styles.row}>
        {track.artworkUrl !== null && !artworkFailed ? (
          <img className={styles.artwork} src={track.artworkUrl} alt="" onError={() => setArtworkFailed(true)} />
        ) : (
          <span className={styles.artwork} aria-hidden="true" />
        )}
        <PageLink
          className={styles.title}
          to={Routes.overview(track.overviewId)}
          onClick={() => analytics.player.miniPlayer.overviewOpened({ overviewId: track.overviewId })}
          data-testid={miniPlayerTestIds.titleLink}
        >
          <span className={styles.titleText}>{track.title}</span>
          <span className={styles.meta} data-testid={miniPlayerTestIds.meta}>
            {metaText(
              view,
              status,
              waiting,
              pausedForOf(status, narrationHeld, heldForAnswer),
              `${section} · ${estimated}${formatClock(time)} / ${length}`,
            )}
          </span>
        </PageLink>
        <button
          type="button"
          className={styles.step}
          onClick={() => {
            analytics.player.miniPlayer.skipped({ overviewId: track.overviewId, direction: "back" });
            engine.skip(-SKIP_SECONDS);
          }}
          disabled={preparing}
          aria-label={`Back ${SKIP_SECONDS} seconds`}
        >
          <StrokeIcon name="rotateCcw" size={16} />
        </button>
        <button
          type="button"
          className={styles.play}
          onClick={() => {
            analytics.player.miniPlayer.playToggled({ overviewId: track.overviewId, playing: !playing && !preparing });
            engine.toggle("miniPlayer");
          }}
          aria-label={mainLabel(view, status)}
          data-testid={miniPlayerTestIds.playButton}
        >
          {preparing || waiting ? (
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
          onClick={() => {
            analytics.player.miniPlayer.skipped({ overviewId: track.overviewId, direction: "forward" });
            engine.skip(SKIP_SECONDS);
          }}
          disabled={preparing}
          aria-label={`Forward ${SKIP_SECONDS} seconds`}
        >
          <StrokeIcon name="rotateCw" size={16} />
        </button>
        <button
          type="button"
          className={styles.step}
          onClick={() => {
            analytics.player.miniPlayer.stopped({ overviewId: track.overviewId });
            onStop();
          }}
          aria-label="Stop and close"
          data-testid={miniPlayerTestIds.closeButton}
        >
          <StrokeIcon name="close" size={16} />
        </button>
      </div>
      <span className={styles.progress} aria-hidden="true">
        {made !== undefined && <span className={styles.progressMade} style={{ width: `${made}%` }} />}
        <span className={`${styles.progressFill} ${source === "pacer" ? styles.progressStone : ""}`} style={{ width: `${percent}%` }} />
      </span>
    </div>
  );
};
