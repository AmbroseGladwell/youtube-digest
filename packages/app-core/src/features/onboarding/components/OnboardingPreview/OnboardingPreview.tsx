import type { ReactNode } from "react";
import { formatClock, type VideoSource } from "@overview/domain";
import { OverviewThumbnail } from "../../../../components/shared/OverviewThumbnail/OverviewThumbnail.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import type { OnboardingRunPhase } from "../../useOnboardingRun.js";
import styles from "./OnboardingPreview.module.scss";
import { onboardingPreviewTestIds } from "./OnboardingPreviewTestIds.js";

const SECTIONS = ["Premise", "Key points", "How to apply", "Verdict"];

export interface OnboardingPreviewProps {
  progress: ReactNode;
  phase: OnboardingRunPhase;
  video: VideoSource | null;
  // The topics it was sorted into, once it is written; an empty list is Unsorted.
  sortedInto: readonly string[] | null;
}

// Design 46d's right-hand side on a wide screen: the overview taking shape beside the
// questions. Its sections are drawn, never their text, so nothing can be read before an
// account; each says only what the run is known to be doing.
export function OnboardingPreview({ progress, phase, video, sortedInto }: OnboardingPreviewProps) {
  const state = phase === "ready" ? "written" : phase === "writing" ? "writing" : "waiting";
  return (
    <aside className={styles.root} aria-label="Your overview" data-testid={onboardingPreviewTestIds.root}>
      {progress}
      {video !== null && (
        <div className={styles.video}>
          <OverviewThumbnail video={video} className={styles.thumb} />
          <span className={styles.meta}>
            <span className={styles.title}>{video.title}</span>
            <span className={styles.byline}>
              {[video.channel, video.durationMs === null ? null : formatClock(video.durationMs / 1000)]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>
        </div>
      )}
      <ul className={styles.sections} aria-label="Sections">
        {SECTIONS.map((name) => (
          <li key={name} className={styles.section} data-testid={onboardingPreviewTestIds.section(name)} data-state={state}>
            <span className={styles.sectionHead}>
              {name}
              {state === "written" ? (
                <span className={styles.written}>
                  <StrokeIcon name="check" size={12} />
                  Written
                </span>
              ) : state === "writing" ? (
                <span className={styles.writing}>Writing</span>
              ) : (
                <span className={styles.waiting}>Waiting</span>
              )}
            </span>
            <span className={styles.bars} aria-hidden="true">
              <span className={styles.bar} />
              <span className={styles.bar} style={{ width: "64%" }} />
            </span>
          </li>
        ))}
        <li className={styles.topicRow}>
          Topic
          {sortedInto === null ? (
            <span className={styles.waiting}>After writing</span>
          ) : (
            <span className={styles.topic} data-testid={onboardingPreviewTestIds.topic}>
              {sortedInto.length === 0 ? "Unsorted" : sortedInto.join(", ")}
            </span>
          )}
        </li>
      </ul>
    </aside>
  );
}
