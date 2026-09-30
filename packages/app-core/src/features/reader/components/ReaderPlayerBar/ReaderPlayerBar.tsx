import { Link } from "react-router";
import type { NoteLine } from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { FavouriteIcon } from "../../../../components/shared/FavouriteIcon/FavouriteIcon.js";
import { PlayPauseIcon } from "../../../../components/shared/PlayPauseIcon/PlayPauseIcon.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { PlayerScrubber } from "../../../player/components/PlayerScrubber/PlayerScrubber.js";
import { SKIP_SECONDS } from "../../../player/PlayerEngine.js";
import type { PlayerBarAction, PlayerBarView } from "../../../player/util/playerBarView.js";
import styles from "./ReaderPlayerBar.module.scss";
import { readerPlayerBarTestIds } from "./ReaderPlayerBarTestIds.js";

export interface ReaderPlayerBarProps {
  view: PlayerBarView;
  time: number;
  lines: NoteLine[];
  lineStarts: number[];
  durationSeconds: number;
  // Design 1b: the panel's bar carries the favourite, since its head has no room for it;
  // the web's head has it and the bar does not (design 1a).
  favourite: { on: boolean; onToggle: () => void } | null;
  // A shell that cannot sign in is not offered the link (CLAUDE.md, degrade visibly).
  canSignIn: boolean;
  onMain: () => void;
  onSkip: (deltaSeconds: number) => void;
  onSeek: (seconds: number) => void;
  onCycleRate: () => void;
  onAction: (action: Exclude<PlayerBarAction, "signIn">) => void;
  onReRecord: () => void;
}

const ACTION_LABELS: Record<PlayerBarAction, string> = {
  tryAgain: "Try again",
  readAlongInstead: "Read along instead",
  readAlong: "Read along",
  readAlongMeanwhile: "Read along meanwhile",
  markRead: "Mark read",
  signIn: "Sign in for audio",
};

function MainIcon({ kind }: { kind: PlayerBarView["main"]["kind"] }) {
  switch (kind) {
    case "cancel":
    case "buffering":
      return (
        <span className={styles.spinner}>
          <StrokeIcon name="loader" size={18} />
        </span>
      );
    case "replay":
      return <StrokeIcon name="rotateCcw" size={18} />;
    default:
      return <PlayPauseIcon playing={kind === "pause"} />;
  }
}

// Design Player.dc.html 1a–1l: the floating card on the web reader, and the same parts
// as grid areas in the panel and on a phone. The label line is the only live region; the
// clock beside it is not announced, or a screen reader would read it four times a second.
export function ReaderPlayerBar({
  view,
  time,
  lines,
  lineStarts,
  durationSeconds,
  favourite,
  canSignIn,
  onMain,
  onSkip,
  onSeek,
  onCycleRate,
  onAction,
  onReRecord,
}: ReaderPlayerBarProps) {
  const actions = view.actions.filter((action) => action !== "signIn" || canSignIn);

  return (
    <div className={styles.root} data-testid={readerPlayerBarTestIds.root}>
      <div className={styles.transport}>
        <button
          type="button"
          className={styles.step}
          onClick={() => onSkip(-SKIP_SECONDS)}
          disabled={!view.skipEnabled}
          aria-label={`Back ${SKIP_SECONDS} seconds`}
          data-testid={readerPlayerBarTestIds.skipBackButton}
        >
          <StrokeIcon name="rotateCcw" size={16} />
        </button>
        <button
          type="button"
          className={styles.play}
          onClick={onMain}
          disabled={view.main.disabled}
          aria-label={view.main.label}
          data-kind={view.main.kind}
          data-testid={readerPlayerBarTestIds.playButton}
        >
          <MainIcon kind={view.main.kind} />
        </button>
        <button
          type="button"
          className={styles.step}
          onClick={() => onSkip(SKIP_SECONDS)}
          disabled={!view.skipEnabled}
          aria-label={`Forward ${SKIP_SECONDS} seconds`}
          data-testid={readerPlayerBarTestIds.skipForwardButton}
        >
          <StrokeIcon name="rotateCw" size={16} />
        </button>
      </div>

      <div className={styles.middle}>
        <div className={styles.meta}>
          <p className={styles.label} aria-live="polite" data-testid={readerPlayerBarTestIds.label}>
            {view.label.pacerTag ? (
              <span className={styles.pacerTag} data-testid={readerPlayerBarTestIds.pacerTag}>
                {view.label.lead}
              </span>
            ) : (
              <strong className={view.label.tone === "warning" ? styles.leadWarning : styles.lead}>
                {view.label.lead}
              </strong>
            )}
            {view.label.rest !== null && (
              <span className={styles.rest}>
                {" · "}
                {view.label.voiceLink ? (
                  <Link
                    className={styles.voiceLink}
                    to={Routes.narrationVoice()}
                    data-testid={readerPlayerBarTestIds.voiceLink}
                  >
                    {view.label.rest}
                  </Link>
                ) : (
                  view.label.rest
                )}
              </span>
            )}
            {view.reRecord !== null && (
              <span className={styles.reRecordInline}>
                {" · "}
                <button
                  type="button"
                  className={styles.reRecordLink}
                  onClick={onReRecord}
                  data-testid={readerPlayerBarTestIds.reRecordInline}
                >
                  {view.reRecord}
                </button>
              </span>
            )}
          </p>
          <span className={styles.clocks}>
            <span className={styles.clockInline} data-testid={readerPlayerBarTestIds.clock}>
              {view.clock.inline}
            </span>
            <span className={styles.clockStart}>{view.clock.start}</span>
            <span className={styles.clockEnd}>{view.clock.end}</span>
          </span>
        </div>
        <div className={styles.scrub}>
          <PlayerScrubber
            view={view}
            time={time}
            lines={lines}
            lineStarts={lineStarts}
            durationSeconds={durationSeconds}
            onSeek={onSeek}
          />
        </div>
      </div>

      {view.note !== null && <p className={styles.note}>{view.note}</p>}

      {view.reRecord !== null && (
        <button
          type="button"
          className={styles.reRecord}
          onClick={onReRecord}
          data-testid={readerPlayerBarTestIds.reRecordButton}
        >
          <StrokeIcon name="rotateCw" size={14} />
          {view.reRecord}
        </button>
      )}

      {actions.length > 0 && (
        <div className={styles.actions}>
          {actions.map((action) =>
            action === "signIn" ? (
              <Link
                key={action}
                className={styles.signIn}
                to={Routes.signIn()}
                data-testid={readerPlayerBarTestIds.signInLink}
              >
                {ACTION_LABELS[action]}
              </Link>
            ) : (
              <button
                key={action}
                type="button"
                className={action === "tryAgain" ? styles.primaryAction : styles.action}
                onClick={() => onAction(action)}
                data-testid={readerPlayerBarTestIds.action(action)}
              >
                {ACTION_LABELS[action]}
              </button>
            ),
          )}
        </div>
      )}

      {favourite !== null && (
        <button
          type="button"
          className={styles.favourite}
          onClick={favourite.onToggle}
          aria-pressed={favourite.on}
          aria-label={favourite.on ? "Favourited" : "Favourite"}
          data-testid={readerPlayerBarTestIds.favouriteButton}
        >
          <FavouriteIcon filled={favourite.on} />
        </button>
      )}

      <button
        type="button"
        className={`${styles.rate} ${view.showRate ? "" : styles.rateHiddenWide}`}
        onClick={onCycleRate}
        aria-label={`Playback speed ${view.rateLabel}`}
        data-testid={readerPlayerBarTestIds.rateButton}
      >
        {view.rateLabel}
      </button>
    </div>
  );
}
