import type { ReactNode } from "react";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./OnboardingPreviewSteps.module.scss";
import { onboardingPreviewStepsTestIds } from "./OnboardingPreviewStepsTestIds.js";

export type OnboardingPreviewStep = "source" | "topics" | "you";

export interface OnboardingPreviewStepsProps {
  // What the source is called in its row: Video, Article or Recipe.
  noun: string;
  fetching: string;
  // What's in hand once fetched, or null while it's still being fetched.
  ready: string | null;
  current: OnboardingPreviewStep | null;
  topics: readonly string[];
  topicsAnswered: boolean;
  personal: boolean;
  soon: boolean;
}

const TOPICS_SHOWN = 4;

// 175a–175d: before writing, what writing waits on, with the step the screen feeds marked Now.
// It claims only what's known: fetched or not, and the answers given so far. Topics show what was
// picked, never where the overview will be filed, and the reader's sentence is never quoted.
export function OnboardingPreviewSteps({
  noun,
  fetching,
  ready,
  current,
  topics,
  topicsAnswered,
  personal,
  soon,
}: OnboardingPreviewStepsProps) {
  const shownTopics = topics.slice(0, TOPICS_SHOWN);
  const moreTopics = topics.length - shownTopics.length;
  return (
    <ol className={styles.root} aria-label="Before writing" data-testid={onboardingPreviewStepsTestIds.root}>
      <Row step="source" current={current} mark={ready === null ? "working" : current === "source" ? "now" : "done"} label={noun}>
        <span className={styles.muted} data-testid={onboardingPreviewStepsTestIds.value("source")}>
          {ready === null ? `${fetching}…` : current === "source" ? `${ready}. Is it the right one?` : ready}
        </span>
      </Row>
      <Row
        step="topics"
        current={current}
        mark={current === "topics" ? "now" : topicsAnswered || topics.length > 0 ? "done" : "to do"}
        label="Topics"
        caption={
          topics.length > 0
            ? "Overviews are checked against these once they're written."
            : topicsAnswered
              ? "It waits in Unsorted until you add one."
              : null
        }
      >
        {topics.length > 0 ? (
          <span className={styles.pills} data-testid={onboardingPreviewStepsTestIds.value("topics")}>
            {shownTopics.map((name) => (
              <span key={name} className={styles.pill}>
                {name}
              </span>
            ))}
            {moreTopics > 0 && <span className={styles.pill}>+{moreTopics}</span>}
          </span>
        ) : (
          <span className={styles.muted} data-testid={onboardingPreviewStepsTestIds.value("topics")}>
            {topicsAnswered ? "None picked" : current === "topics" ? "Pick as many as you like" : "Next"}
          </span>
        )}
      </Row>
      <Row step="you" current={current} mark={personal ? "done" : current === "you" ? "now" : "to do"} label="Written for you">
        {personal ? (
          <span className={styles.personalised} data-testid={onboardingPreviewStepsTestIds.value("you")}>
            <StrokeIcon name="check" size={13} />
            Personalised
          </span>
        ) : (
          <span className={styles.muted} data-testid={onboardingPreviewStepsTestIds.value("you")}>
            {current === "you" ? "Fill in as much as you like. Personalises your overviews." : "Not yet"}
          </span>
        )}
      </Row>
      <li className={styles.writing}>
        <Mark mark="to do" />
        <span className={styles.writingHead}>
          Writing
          <span className={styles.muted}>{soon ? "Starts when you continue" : "Starts after these"}</span>
        </span>
      </li>
    </ol>
  );
}

type RowMark = "working" | "now" | "done" | "to do";

function Row({
  step,
  current,
  mark,
  label,
  caption = null,
  children,
}: {
  step: OnboardingPreviewStep;
  current: OnboardingPreviewStep | null;
  mark: RowMark;
  label: string;
  caption?: string | null;
  children: ReactNode;
}) {
  const now = current === step;
  return (
    <li
      className={now ? styles.rowNow : styles.row}
      aria-current={now ? "step" : undefined}
      data-testid={onboardingPreviewStepsTestIds.row(step)}
    >
      <Mark mark={mark} />
      <span className={styles.body}>
        <span className={styles.head}>
          {label}
          {now && (
            <span className={styles.now} aria-hidden="true">
              Now
            </span>
          )}
        </span>
        {children}
        {caption !== null && <span className={styles.caption}>{caption}</span>}
      </span>
    </li>
  );
}

function Mark({ mark }: { mark: RowMark }) {
  if (mark === "working") {
    return (
      <span className={styles.spinner} aria-hidden="true">
        <StrokeIcon name="loader" size={18} />
      </span>
    );
  }
  if (mark === "done") {
    return (
      <span className={styles.tick} aria-hidden="true">
        <StrokeIcon name="check" size={13} />
      </span>
    );
  }
  return <span className={mark === "now" ? styles.ringNow : styles.ring} aria-hidden="true" />;
}
