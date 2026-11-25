import { resumeTimeText } from "../../../transcripts/util/resumeTime.js";
import { PlansModal } from "../../../plus/components/PlansModal/PlansModal.js";
import { usePlanPrompt } from "../../../plus/usePlanPrompt.js";
import { useSurface } from "../../../../app/SurfaceContext.js";
import { newOverviewDialogTestIds } from "../NewOverviewDialog/NewOverviewDialogTestIds.js";
import { useState } from "react";
import { domainOf, type Overview, type SavedCapture } from "@overview/domain";
import { OverviewThumbnail } from "../../../../components/shared/OverviewThumbnail/OverviewThumbnail.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useIsPhone } from "../../../../util/useIsPhone.js";
import type { WaitingLinkView } from "../../useNewOverviewRun.js";
import type { NewOverviewRun } from "../../types/NewOverviewRun.js";
import { CaptureReasonField } from "../CaptureReasonField/CaptureReasonField.js";
import { justNowRowOf, type JustNowRow } from "./justNowRowOf.js";
import styles from "./JustNowList.module.scss";
import { justNowListTestIds } from "./JustNowListTestIds.js";

export interface JustNowListProps {
  runs: NewOverviewRun[];
  current: NewOverviewRun | null;
  waiting: WaitingLinkView[];
  resetsOn: string | null;
  failure: (run: NewOverviewRun) => React.ReactNode;
  onReadOverview: (overview: Overview) => void;
  onOpenSaved: (capture: SavedCapture) => void;
  onCaptureReasonChange: (reason: string) => void;
  onCaptureReasonCommit: () => void;
  onKeep: (run: NewOverviewRun) => void;
}

interface KeepNoticeProps {
  run: NewOverviewRun;
  onKeep: (run: NewOverviewRun) => void;
}

// Design 358g: the run stopped at our server's cap, and the link can wait for it, or for the extension.
const KeepNotice = ({ run, onKeep }: KeepNoticeProps) => {
  const [declined, setDeclined] = useState(false);
  const time = resumeTimeText(new Date(run.keepable!.resumesAt));
  if (run.kept === true) {
    return (
      <div className={styles.keep} data-testid={justNowListTestIds.kept}>
        <b>Kept. It’ll be made after {time}.</b>
        <span>Or sooner: the moment the extension is open on a computer, it makes it there. You don’t need to come back for it.</span>
        <span className={styles.chip}>
          <StrokeIcon name="clock" size={12} />
          Continues after {time}
        </span>
      </div>
    );
  }
  if (declined) {
    return null;
  }
  return (
    <div className={styles.keep} data-testid={justNowListTestIds.keepNotice}>
      <b>This one can’t be fetched right now.</b>
      <span>
        Fetching from YouTube is paused on us until {time}. Keep it, and it’s made after {time}, or as soon as you open the extension on a
        computer, whichever comes first.
      </span>
      <span className={styles.keepActions}>
        <button
          type="button"
          className={styles.keepButton}
          onClick={() => onKeep(run)}
          aria-label={`Keep it: made after ${time} or in the extension`}
          data-testid={justNowListTestIds.keepIt}
        >
          Keep it
        </button>
        <button type="button" className={styles.link} onClick={() => setDeclined(true)}>
          Not now
        </button>
      </span>
    </div>
  );
};

interface HeadProps {
  run: NewOverviewRun;
  row: JustNowRow;
}

const Head = ({ run, row }: HeadProps) => (
  <div className={styles.head}>
    {run.video === null ? (
      <span className={styles.placeholder} aria-hidden="true">
        <StrokeIcon name="link" size={15} />
      </span>
    ) : (
      <OverviewThumbnail video={run.video} className={styles.thumbnail} />
    )}
    <span className={styles.text}>
      <span className={styles.kicker}>{row.kicker}</span>
      <span className={styles.title}>{row.title}</span>
    </span>
  </div>
);

// Design 358b: each link Create was given, and how far it has got.
const transcribedSecondsOf = (run: NewOverviewRun): number | null =>
  run.podcast?.durationSeconds ?? run.tiktok?.durationSeconds ?? run.social?.post.durationSeconds ?? null;

const transcribingNow = (run: NewOverviewRun): boolean =>
  [run.podcast, run.tiktok, run.social].some((source) => source !== null && source.words === null && source.transcription !== null);

interface TranscribingPlusLineProps {
  episodeSeconds: number | null;
}

// Design 351e: only when this one leaves under 2 hours this month; true to Plus, which gives more hours, never faster.
const TranscribingPlusLine = ({ episodeSeconds }: TranscribingPlusLineProps) => {
  const { prompt, plan, chose } = usePlanPrompt({ kind: "transcribing", episodeSeconds });
  const [plansOpen, setPlansOpen] = useState(false);
  if (prompt?.variant !== "transcribing") {
    return null;
  }
  return (
    <>
      <p className={styles.plusLine} data-testid={justNowListTestIds.plusLine}>
        <StrokeIcon name="gem" size={15} weight={1.8} />
        <span>
          Plus gives you {prompt.moreHours} hours more transcribing a month.{" "}
          <button
            type="button"
            className={styles.plansLink}
            onClick={() => {
              chose("seePlans");
              setPlansOpen(true);
            }}
          >
            See plans
          </button>
        </span>
      </p>
      <PlansModal open={plansOpen} plan={plan} onClose={() => setPlansOpen(false)} />
    </>
  );
};

export const JustNowList = ({
  runs,
  current,
  waiting,
  resetsOn,
  failure,
  onReadOverview,
  onOpenSaved,
  onCaptureReasonChange,
  onCaptureReasonCommit,
  onKeep,
}: JustNowListProps) => {
  const phone = useIsPhone();
  const surface = useSurface();
  const [reasonOpen, setReasonOpen] = useState<number | null>(null);
  const running = current !== null && current.finishedAt === null ? current : null;
  if (runs.length === 0 && running === null && waiting.length === 0) {
    return null;
  }

  const runRow = (run: NewOverviewRun) => {
    const row = justNowRowOf(run);
    const inProgress = row.stage === "fetch" || row.stage === "write";
    return (
      <li
        key={run.startedAt}
        className={styles.row}
        data-testid={justNowListTestIds.row}
        data-stage={row.stage}
        data-step={row.step}
        data-steps={row.steps}
        aria-label={row.title}
      >
        <Head run={run} row={row} />
        {inProgress && (
          <>
            <p className={styles.status} data-testid={justNowListTestIds.status}>
              <b>{row.label}</b>
              <span>
                · Step {row.step} of {row.steps}
                {row.detail === "" ? "" : ` · ${row.detail}`}
              </span>
            </p>
            <span className={styles.bar} aria-hidden="true">
              <i />
            </span>
            {run === running && transcribingNow(run) && <TranscribingPlusLine episodeSeconds={transcribedSecondsOf(run)} />}
          </>
        )}
        {row.stage === "done" && (
          <div className={styles.foot}>
            <span className={styles.chip}>
              <StrokeIcon name="check" size={12} />
              Made
            </span>
            <span data-testid={justNowListTestIds.status}>{row.detail}</span>
            <span className={styles.spacer} />
            <button
              type="button"
              className={styles.link}
              onClick={() => onReadOverview(run.overview!)}
              data-testid={justNowListTestIds.readOverview}
            >
              Read overview
            </button>
          </div>
        )}
        {row.stage === "saved" && (
          <div className={styles.foot}>
            <span className={styles.chip}>
              <StrokeIcon name="bookmark" size={12} />
              Saved · no overview yet
            </span>
            <span data-testid={justNowListTestIds.status}>
              {run.saved!.source.kind === "web" ? "Saved" : "Transcript ready"}
              {resetsOn === null ? "" : ` · overview from ${resetsOn}`}
            </span>
            <span className={styles.spacer} />
            <button
              type="button"
              className={styles.link}
              onClick={() => onOpenSaved(run.saved!)}
              data-testid={justNowListTestIds.openSaved}
            >
              Open it
            </button>
          </div>
        )}
        {row.stage === "keptForReset" && (
          <div className={styles.foot}>
            <span className={styles.chip}>
              <StrokeIcon name="clock" size={12} />
              Kept
            </span>
            <span data-testid={justNowListTestIds.status}>
              No transcribing left this month · transcribed and made{resetsOn === null ? " after the reset" : ` on ${resetsOn}`}
            </span>
          </div>
        )}
        {row.stage === "failed" && (run.keepable == null ? failure(run) : <KeepNotice run={run} onKeep={onKeep} />)}
        {(inProgress || row.stage === "done") &&
          run.startedAt === current?.startedAt &&
          !phone &&
          (reasonOpen === run.startedAt || Boolean(run.captureReason) ? (
            <CaptureReasonField value={run.captureReason} onChange={onCaptureReasonChange} onCommit={onCaptureReasonCommit} />
          ) : (
            <button
              type="button"
              className={styles.quiet}
              onClick={() => setReasonOpen(run.startedAt)}
              data-testid={justNowListTestIds.addReason}
            >
              Add a reason
            </button>
          ))}
      </li>
    );
  };

  return (
    <section className={styles.root} aria-label="Just now" data-testid={justNowListTestIds.root}>
      <p className={styles.heading}>Just now</p>
      <ol className={styles.list} aria-live="polite">
        {runs.map(runRow)}
        {running !== null && runRow(running)}
        {waiting.map((link) => (
          <li key={`waiting-${link.key}`} className={styles.row} data-testid={justNowListTestIds.row} data-stage="next">
            <div className={styles.head}>
              {link.video === null ? (
                <span className={styles.placeholder} aria-hidden="true">
                  <StrokeIcon name="link" size={15} />
                </span>
              ) : (
                <OverviewThumbnail video={link.video} className={styles.thumbnail} />
              )}
              <span className={styles.text}>
                <span className={styles.kicker}>{link.video?.channel ?? domainOf(link.url)}</span>
                <span className={styles.title}>{link.video?.title ?? link.url}</span>
              </span>
            </div>
            <p className={styles.status} data-testid={justNowListTestIds.status}>
              <b>Next</b>
              <span>{link.video === null ? " · after the one being written" : " · Transcript ready"}</span>
            </p>
          </li>
        ))}
      </ol>
      {(running !== null || waiting.length > 0) && (
        <p className={styles.footNote} data-testid={newOverviewDialogTestIds.footNote}>
          You can close this, it keeps going.{surface === "extension" && " Closing the side panel does stop it."}
        </p>
      )}
    </section>
  );
};
