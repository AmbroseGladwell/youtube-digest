import { useEffect, useRef, useState } from "react";
import type { QueuedCapture, VideoId } from "@overview/domain";
import { Link } from "react-router";
import { useIsPanel } from "../../../app/LayoutContext.js";
import { Routes } from "../../../app/Routes.js";
import { StrokeIcon } from "../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useIsPhone } from "../../../util/useIsPhone.js";
import { useAnalytics } from "../../analytics/AnalyticsContext.js";
import { TRIAL_SPENT_ACTION, TRIAL_SPENT_DETAIL, TRIAL_SPENT_HEADING } from "../../signedOutTrial/trialPrompt.js";
import { useCaptureQueueController } from "../CaptureQueueContext.js";
import { AttentionRow } from "../components/AttentionRow/AttentionRow.js";
import { PacedQueueGroup } from "../components/PacedQueueGroup/PacedQueueGroup.js";
import { QueueRow } from "../components/QueueRow/QueueRow.js";
import { makingStep } from "../util/makingStep.js";
import { queueHoldNote } from "../util/queueHoldCopy.js";
import { useLeftThisMonth } from "../../newOverview/useNextQuota.js";
import { monthHoldNote, monthHoldWays, monthResumeDate } from "../util/monthHoldCopy.js";
import { chosenBarLine, madeNowNotice, madeNowOf, makeChosenLabel } from "../util/chooseCopy.js";
import { pacedGroups, waitingRows } from "../util/queueRows.js";
import styles from "./QueuePage.module.scss";
import { queuePageTestIds } from "./QueuePageTestIds.js";

// Design 27j–27o: what is being made, what waits in order, and what needs the reader, on a
// page of its own. The queue is this device's until OV-11, so the page says where it runs
// rather than promising it happens anywhere (docs/features/capture-queue.md). Design
// 95aa–95aj: what waits on a pace, or for the reader, by playlist after it, with Make now on
// each and Choose for several.
export function QueuePage() {
  const queue = useCaptureQueueController();
  const analytics = useAnalytics();
  const isPanel = useIsPanel();
  const isPhone = useIsPhone();
  const stacked = isPanel || isPhone;
  const heading = useRef<HTMLHeadingElement>(null);
  const confirmTitle = useRef<HTMLParagraphElement>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [chosen, setChosen] = useState<ReadonlySet<VideoId> | null>(null);
  const [notice, setNotice] = useState<{ lead: string; rest: string } | null>(null);
  const rows = waitingRows(queue);
  const waitingCount = queue.waiting.length;
  const monthHeld = queue.hold?.reason === "monthSpent" && !queue.needsKey && !queue.trialSpent;
  const tomorrowGroups = monthHeld ? [] : pacedGroups(queue.tomorrow, queue);
  const forYouGroups = pacedGroups(queue.forYou, queue);
  const canMakeNow = !queue.needsKey && !queue.trialSpent && queue.hold === null;
  const chosenCaptures = chosen === null ? [] : [...queue.tomorrow, ...queue.forYou].filter((capture) => chosen.has(capture.videoId));
  const leftThisMonth = useLeftThisMonth();
  const allowance = leftThisMonth?.resetsOn == null ? null : { left: leftThisMonth.left, resetsOn: leftThisMonth.resetsOn };
  const madeNowCount = madeNowOf(chosenCaptures.length, allowance);

  useEffect(() => heading.current?.focus({ preventScroll: true }), []);
  useEffect(() => {
    if (chosen === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        analytics.queue.choose.cancelled();
        setChosen(null);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [chosen, analytics]);

  const toggle = (videoId: VideoId) =>
    setChosen((current) => {
      const next = new Set(current ?? []);
      if (next.has(videoId)) next.delete(videoId);
      else next.add(videoId);
      return next;
    });
  const chooseAll = (videoIds: VideoId[], choose: boolean) =>
    setChosen((current) => {
      const next = new Set(current ?? []);
      for (const videoId of videoIds) {
        if (choose) next.add(videoId);
        else next.delete(videoId);
      }
      return next;
    });
  const makeNow = (captures: QueuedCapture[]) => {
    setNotice(madeNowNotice(captures, queue.paceOf));
    void queue.makeNow(captures.map((capture) => capture.videoId));
  };

  const chooseControl = (
    <button
      type="button"
      className={chosen === null ? styles.secondary : styles.ghost}
      aria-pressed={chosen !== null}
      onClick={() => {
        if (chosen === null) analytics.queue.choose.started();
        else analytics.queue.choose.cancelled();
        setChosen(chosen === null ? new Set() : null);
      }}
      data-testid={queuePageTestIds.chooseButton}
    >
      {chosen === null ? "Choose" : "Cancel"}
    </button>
  );

  const pacedSection = (groups: typeof tomorrowGroups, waitsFor: "tomorrow" | "you") => {
    const total = groups.reduce((sum, group) => sum + group.captures.length, 0);
    return (
      <div className={styles.group} data-testid={waitsFor === "you" ? queuePageTestIds.forYou : queuePageTestIds.tomorrow}>
        <div className={styles.pacedHead}>
          <span className={styles.pacedHeadText}>
            <p className={styles.label} data-testid={waitsFor === "you" ? queuePageTestIds.forYouLabel : queuePageTestIds.tomorrowLabel}>
              {waitsFor === "you" ? "Waiting for you" : "Continues tomorrow"} · {total.toLocaleString("en-GB")}
            </p>
            <span className={styles.pacedSub}>
              {waitsFor === "you"
                ? "Made only when you choose them. They use none of your allowance until then."
                : "These playlists have reached today’s pace. The rest of the queue keeps going."}
            </span>
          </span>
          {!monthHeld && chooseControl}
        </div>
        {groups.map((group) => (
          <PacedQueueGroup
            key={group.playlist.id}
            group={group}
            waitsFor={waitsFor}
            stacked={stacked}
            canMakeNow={canMakeNow}
            chosen={chosen}
            onToggle={toggle}
            onChooseAll={chooseAll}
            onMakeNow={(capture) => {
              analytics.queue.item.madeNow({ pace: group.pace });
              makeNow([capture]);
            }}
            onRemove={(capture) => {
              analytics.queue.item.removed();
              queue.remove(capture.videoId);
            }}
          />
        ))}
      </div>
    );
  };
  useEffect(() => {
    if (confirmingClear) confirmTitle.current?.focus();
  }, [confirmingClear]);

  const intro = isPanel
    ? "Made while this panel or the extension is open. Continues next time."
    : isPhone
      ? "Made oldest first while The Overview is open on this phone. Continues next time you open it."
      : "Videos from playlists you follow, made one at a time, oldest first, while The Overview is open on this computer. A playlist with a pace makes up to its number a day. Close The Overview and the queue waits; it continues next time you open it.";

  const pauseControl = queue.needsKey || queue.trialSpent || monthHeld ? null : queue.paused ? (
    <button
      type="button"
      className={stacked ? styles.iconPrimary : styles.primary}
      onClick={() => {
        analytics.queue.controls.resumed({ from: "page" });
        queue.setPaused(false);
      }}
      aria-label={stacked ? "Resume queue" : undefined}
      data-testid={queuePageTestIds.resumeButton}
    >
      <StrokeIcon name="play" size={stacked ? 18 : 13} />
      {!stacked && "Resume queue"}
    </button>
  ) : (
    <button
      type="button"
      className={stacked ? styles.iconSecondary : styles.secondary}
      onClick={() => {
        analytics.queue.controls.paused({ from: "page" });
        queue.setPaused(true);
      }}
      aria-label={stacked ? "Pause queue" : undefined}
      data-testid={queuePageTestIds.pauseButton}
    >
      <StrokeIcon name="pause" size={stacked ? 18 : 13} />
      {!stacked && "Pause queue"}
    </button>
  );

  const clearControl =
    waitingCount === 0 || confirmingClear ? null : (
      <button
        type="button"
        className={stacked ? styles.iconGhost : styles.ghost}
        onClick={() => {
          analytics.queue.controls.clearAsked();
          setConfirmingClear(true);
        }}
        aria-label={stacked ? "Clear queue" : undefined}
        data-testid={queuePageTestIds.clearButton}
      >
        <StrokeIcon name="trash" size={stacked ? 18 : 13} />
        {!stacked && "Clear queue"}
      </button>
    );

  return (
    <div className={`${styles.root} ${stacked ? styles.stacked : ""}`} data-testid={queuePageTestIds.root}>
      <Link className={styles.backLink} to={Routes.home()} data-testid={queuePageTestIds.backLink}>
        <StrokeIcon name="arrowLeft" /> {isPanel ? "Back" : "Overviews"}
      </Link>

      <div className={styles.head}>
        <div className={styles.headText}>
          <h1 ref={heading} className={styles.title} tabIndex={-1} data-testid={queuePageTestIds.heading}>
            Queue
          </h1>
          <p className={styles.intro}>{intro}</p>
        </div>
        <div className={styles.controls}>
          {waitingCount > 0 && pauseControl}
          {clearControl}
        </div>
      </div>

      {confirmingClear && (
        <div className={styles.confirm} role="group" aria-labelledby="queue-clear-title" data-testid={queuePageTestIds.clearConfirm}>
          <p className={styles.confirmText} id="queue-clear-title" ref={confirmTitle} tabIndex={-1}>
            <strong>Clear the queue?</strong> All {waitingCount.toLocaleString("en-GB")} waiting{" "}
            {waitingCount === 1 ? "video is" : "videos are"} removed. Your playlists stay followed, so new videos still
            arrive.
          </p>
          <span className={styles.confirmActions}>
            <button
              type="button"
              className={styles.primary}
              onClick={() => {
                void queue.clear().then((removed) => analytics.queue.controls.cleared({ removed }));
                setConfirmingClear(false);
                heading.current?.focus();
              }}
              data-testid={queuePageTestIds.confirmClearButton}
            >
              Clear queue
            </button>
            <button
              type="button"
              className={styles.ghost}
              onClick={() => {
                analytics.queue.controls.clearKept();
                setConfirmingClear(false);
              }}
              data-testid={queuePageTestIds.keepButton}
            >
              Keep
            </button>
          </span>
        </div>
      )}

      {queue.trialSpent && waitingCount > 0 && (
        <div className={styles.noKey} data-testid={queuePageTestIds.trialSpentNote}>
          <span className={styles.noKeyIcon} aria-hidden="true">
            <StrokeIcon name="userPlus" size={18} />
          </span>
          <p className={styles.noKeyText}>
            {TRIAL_SPENT_HEADING} {TRIAL_SPENT_DETAIL} The queue starts again once you're signed in.
          </p>
          <Link
            className={styles.primary}
            to={Routes.createAccount()}
            onClick={() => analytics.account.trial.createAccountChosen({ from: "queue" })}
            data-testid={queuePageTestIds.createAccountLink}
          >
            {TRIAL_SPENT_ACTION}
          </Link>
        </div>
      )}

      {queue.needsKey && waitingCount > 0 && (
        <div className={styles.noKey} data-testid={queuePageTestIds.noKeyNote}>
          <span className={styles.noKeyIcon} aria-hidden="true">
            <StrokeIcon name="key" size={18} />
          </span>
          <p className={styles.noKeyText}>
            Overviews are made with your own API key, and none is saved {isPanel ? "in the extension" : "here"}. Add one
            and the queue starts straight away.
          </p>
          <Link
            className={styles.primary}
            to={Routes.settingsSection("keys")}
            onClick={() => analytics.queue.controls.keysLinkFollowed({ from: "page" })}
            data-testid={queuePageTestIds.addKeyLink}
          >
            Add a key
          </Link>
        </div>
      )}

      {monthHeld && queue.hold !== null && waitingCount > 0 && (
        <div className={styles.held} data-testid={queuePageTestIds.heldNote}>
          <span className={styles.heldIcon} aria-hidden="true">
            <StrokeIcon name="clock" size={18} />
          </span>
          <p className={styles.heldText}>{monthHoldNote(queue.hold, queue.limit)}</p>
          {monthHoldWays(queue.limit).map((way, index) => (
            <Link
              key={way}
              className={index === 0 ? styles.primary : styles.secondary}
              to={way === "addKey" ? Routes.settingsSection("keys") : Routes.settingsSection("plan")}
              onClick={() => analytics.capture.limitMessage.wayChosen({ way, from: "queuePage" })}
              data-testid={way === "addKey" ? queuePageTestIds.addKeyLink : queuePageTestIds.seePlansLink}
            >
              {way === "addKey" ? "Add a key" : "See plans"}
            </Link>
          ))}
        </div>
      )}

      {!monthHeld && queue.hold !== null && waitingCount > 0 && (
        <div className={styles.held} data-testid={queuePageTestIds.heldNote}>
          <span className={styles.heldIcon} aria-hidden="true">
            <StrokeIcon name="clock" size={18} />
          </span>
          <p className={styles.heldText}>{queueHoldNote(queue.hold, waitingCount, queue.viaExtension)}</p>
        </div>
      )}

      {notice !== null && (
        <div className={styles.notice} role="status" aria-live="polite" data-testid={queuePageTestIds.madeNowNotice}>
          <StrokeIcon name="check" size={16} />
          <p className={styles.noticeText}>
            <strong>{notice.lead}</strong> {notice.rest}
          </p>
        </div>
      )}

      {queue.making !== null && (
        <div className={styles.group}>
          <p className={styles.label}>Making now</p>
          <ul className={styles.list} data-testid={queuePageTestIds.making}>
            <QueueRow capture={queue.making.capture} state="making" position={null} dense {...makingStep(queue.making.run, stacked)} />
          </ul>
        </div>
      )}

      {rows.length > 0 && (
        <div className={styles.group}>
          <p className={styles.label} data-testid={queuePageTestIds.waitingLabel}>
            Waiting · {rows.length.toLocaleString("en-GB")}
            {monthHeld && queue.hold !== null && ` · resumes ${monthResumeDate(queue.hold, stacked)}`}
          </p>
          <ol className={styles.list} data-testid={queuePageTestIds.waiting}>
            {rows.map(({ capture, state, resumeTime }, index) => (
              <QueueRow
                key={capture.videoId}
                capture={capture}
                state={state}
                position={index + 1}
                resumeTime={resumeTime}
                dense
                onRemove={() => {
                  analytics.queue.item.removed();
                  queue.remove(capture.videoId);
                }}
              />
            ))}
          </ol>
        </div>
      )}

      {tomorrowGroups.length > 0 && pacedSection(tomorrowGroups, "tomorrow")}
      {forYouGroups.length > 0 && pacedSection(forYouGroups, "you")}

      {queue.attention.length > 0 && (
        <div className={styles.group} id="needs-attention">
          <p className={styles.label} data-testid={queuePageTestIds.attentionLabel}>
            Needs attention · {queue.attention.length.toLocaleString("en-GB")}
          </p>
          <ul className={styles.attentionList} data-testid={queuePageTestIds.attention}>
            {queue.attention.map((capture) => (
              <AttentionRow
                key={capture.videoId}
                capture={capture}
                stacked={stacked}
                onRetry={() => {
                  analytics.queue.item.retried({ problem: capture.problem ?? "failed" });
                  queue.retry(capture.videoId);
                }}
                onDismiss={() => {
                  analytics.queue.item.dismissed({ problem: capture.problem ?? "failed" });
                  queue.dismiss(capture.videoId);
                }}
              />
            ))}
          </ul>
        </div>
      )}

      {queue.making === null && waitingCount === 0 && queue.attention.length === 0 && (
        <div className={styles.empty} data-testid={queuePageTestIds.empty}>
          <p className={styles.emptyTitle}>Nothing is waiting</p>
          <p className={styles.emptyBody}>
            New videos in the playlists you follow are queued each time you open The Overview.{" "}
            <Link to={Routes.settingsSection("playlists")}>Your playlists</Link>
          </p>
        </div>
      )}

      {chosenCaptures.length > 0 && (
        <div className={`${styles.chosenBar} ${stacked ? styles.chosenBarStacked : ""}`} role="region" aria-label="Chosen videos" data-testid={queuePageTestIds.chosenBar}>
          <div className={styles.chosenText} role="status" aria-live="polite">
            <span className={styles.chosenCount} data-testid={queuePageTestIds.chosenCount}>
              {chosenCaptures.length.toLocaleString("en-GB")} chosen
            </span>
            <span className={styles.chosenLine} data-testid={queuePageTestIds.chosenLine}>
              {chosenBarLine(chosenCaptures, queue.paceOf, allowance)}
            </span>
          </div>
          <span className={styles.chosenActions}>
            <button
              type="button"
              className={styles.ghost}
              onClick={() => {
                analytics.queue.choose.removed({ videos: chosenCaptures.length });
                void queue.removeMany(chosenCaptures.map((capture) => capture.videoId));
                setChosen(null);
              }}
              data-testid={queuePageTestIds.removeChosenButton}
            >
              Remove
            </button>
            {canMakeNow && (
              <button
                type="button"
                className={styles.primary}
                onClick={() => {
                  const madeNow = [...chosenCaptures].sort((a, b) => a.queuedAt.localeCompare(b.queuedAt)).slice(0, madeNowCount);
                  analytics.queue.choose.madeNow({ videos: madeNow.length });
                  makeNow(madeNow);
                  setChosen(null);
                }}
                data-testid={queuePageTestIds.makeChosenButton}
              >
                {makeChosenLabel(madeNowCount)}
              </button>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
