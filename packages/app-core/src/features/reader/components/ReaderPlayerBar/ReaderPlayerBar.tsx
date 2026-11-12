import type { NoteLine } from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { FavouriteIcon } from "../../../../components/shared/FavouriteIcon/FavouriteIcon.js";
import { PlayPauseIcon } from "../../../../components/shared/PlayPauseIcon/PlayPauseIcon.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { PlayerScrubber } from "../../../player/components/PlayerScrubber/PlayerScrubber.js";
import { lineAtTime } from "../../../player/util/lineAtTime.js";
import { isInSourceSteps, sourceStepsStretch } from "../../../player/util/sourceStepsStretch.js";
import type { PlayerStatus } from "../../../player/types/PlayerSnapshot.js";
import { SKIP_SECONDS } from "../../../player/PlayerEngine.js";
import { useOverviewPageAnalytics } from "../../../analytics/OverviewAnalyticsContext.js";
import { usePlayer } from "../../../player/PlayerContext.js";
import type { PlayerBarAction, PlayerBarView } from "../../../player/util/playerBarView.js";
import styles from "./ReaderPlayerBar.module.scss";
import { readerPlayerBarTestIds } from "./ReaderPlayerBarTestIds.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";

export interface ReaderPlayerBarProps {
  view: PlayerBarView;
  // The state the view was built from, which is what the main button's press is counted under.
  status: PlayerStatus;
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
  // Cooking step by step from the action the voice is on, while it is in a recipe's method
  // (design 150b).
  onCookFromHere: (() => void) | null;
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
  status,
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
  onCookFromHere,
}: ReaderPlayerBarProps) {
  const actions = view.actions.filter((action) => action !== "signIn" || canSignIn);
  const analytics = useOverviewPageAnalytics();
  const player = usePlayer();
  const reRecord = () => {
    analytics.playerBar.reRecordChosen();
    onReRecord();
  };
  // Design 250f: while the voice is in the steps a source gives, a way past them to what follows.
  const steps = sourceStepsStretch(lines);
  const pastSteps = steps?.after == null ? undefined : lineStarts[steps.after];
  const skipSteps =
    view.seekable && pastSteps !== undefined && isInSourceSteps(steps, lineAtTime(lineStarts, time))
      ? { to: pastSteps, next: lines[steps!.after!]!.text }
      : null;

  return (
    <div className={styles.root} data-testid={readerPlayerBarTestIds.root}>
      <div className={styles.transport}>
        <button
          type="button"
          className={styles.step}
          onClick={() => {
            analytics.playerBar.skipped({ direction: "back" });
            onSkip(-SKIP_SECONDS);
          }}
          disabled={!view.skipEnabled}
          aria-label={`Back ${SKIP_SECONDS} seconds`}
          data-testid={readerPlayerBarTestIds.skipBackButton}
        >
          <StrokeIcon name="rotateCcw" size={16} />
        </button>
        <button
          type="button"
          className={styles.play}
          onClick={() => {
            analytics.playerBar.mainPressed({ button: view.main.kind, state: status });
            onMain();
          }}
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
          onClick={() => {
            analytics.playerBar.skipped({ direction: "forward" });
            onSkip(SKIP_SECONDS);
          }}
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
              <strong className={view.label.tone === "warning" ? styles.leadWarning : styles.lead}>{view.label.lead}</strong>
            )}
            {view.label.rest !== null && (
              <span className={styles.rest}>
                {" · "}
                {view.label.voiceLink ? (
                  <PageLink
                    className={styles.voiceLink}
                    to={Routes.settingsSection("voice")}
                    onClick={() => analytics.playerBar.voiceLinkFollowed()}
                    data-testid={readerPlayerBarTestIds.voiceLink}
                  >
                    {view.label.rest}
                  </PageLink>
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
                  onClick={reRecord}
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
            onSeek={(seconds) => {
              analytics.playerBar.seeked();
              onSeek(seconds);
            }}
          />
        </div>
      </div>

      {view.note !== null && <p className={styles.note}>{view.note}</p>}

      {view.reRecord !== null && (
        <button type="button" className={styles.reRecord} onClick={reRecord} data-testid={readerPlayerBarTestIds.reRecordButton}>
          <StrokeIcon name="rotateCw" size={14} />
          {view.reRecord}
        </button>
      )}

      {(actions.length > 0 || onCookFromHere !== null || skipSteps !== null) && (
        <div className={styles.actions}>
          {skipSteps !== null && (
            <button
              type="button"
              className={styles.action}
              onClick={() => {
                analytics.sourceSteps.skipped();
                onSeek(skipSteps.to);
              }}
              aria-label={`Skip the steps, to ${skipSteps.next}`}
              data-testid={readerPlayerBarTestIds.skipSteps}
            >
              <StrokeIcon name="skipForward" size={14} />
              <span className={styles.skipStepsWide}>Skip to {skipSteps.next}</span>
              <span className={styles.skipStepsNarrow}>Skip steps</span>
            </button>
          )}
          {onCookFromHere !== null && (
            <button type="button" className={styles.action} onClick={onCookFromHere} data-testid={readerPlayerBarTestIds.cookFromHere}>
              <StrokeIcon name="chefHat" size={14} />
              Cook from here
            </button>
          )}
          {actions.map((action) =>
            action === "signIn" ? (
              <PageLink
                key={action}
                className={styles.signIn}
                to={Routes.signIn()}
                onClick={() => analytics.playerBar.actionChosen({ action })}
                data-testid={readerPlayerBarTestIds.signInLink}
              >
                {ACTION_LABELS[action]}
              </PageLink>
            ) : (
              <button
                key={action}
                type="button"
                className={action === "tryAgain" ? styles.primaryAction : styles.action}
                onClick={() => {
                  analytics.playerBar.actionChosen({ action });
                  onAction(action);
                }}
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
        onClick={() => {
          onCycleRate();
          analytics.playerBar.rateChanged({ rate: player.getSnapshot().rate });
        }}
        aria-label={`Playback speed ${view.rateLabel}`}
        data-testid={readerPlayerBarTestIds.rateButton}
      >
        {view.rateLabel}
      </button>
    </div>
  );
}
