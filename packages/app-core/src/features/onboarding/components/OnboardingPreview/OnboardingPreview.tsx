import type { ReactNode } from "react";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import type { OnboardingFound, OnboardingSource } from "../../onboardingSources.js";
import type { OnboardingRunPhase } from "../../useOnboardingRun.js";
import { writingStarts } from "../../util/writingStarts.js";
import { OnboardingPreviewSteps, type OnboardingPreviewStep } from "../OnboardingPreviewSteps/OnboardingPreviewSteps.js";
import { OnboardingSourceCard } from "../OnboardingSourceCard/OnboardingSourceCard.js";
import styles from "./OnboardingPreview.module.scss";
import { onboardingPreviewTestIds } from "./OnboardingPreviewTestIds.js";

// What the answers so far have given the overview, as far as the preview may say.
export interface OnboardingPreviewAnswers {
  current: OnboardingPreviewStep | null;
  topics: readonly string[];
  topicsAnswered: boolean;
  personal: boolean;
  // The next Continue lets writing go.
  soon: boolean;
  voice: string;
}

export interface OnboardingPreviewProps {
  // The bar, once writing has started.
  progress: ReactNode | null;
  phase: OnboardingRunPhase;
  kind: OnboardingSource | null;
  found: OnboardingFound | null;
  // A failure before the source was in hand leaves nothing to make; one while writing keeps it.
  failure: "fetch" | "write" | null;
  answers: OnboardingPreviewAnswers;
  // The topics it was sorted into, once it is written; an empty list is Unsorted.
  sortedInto: readonly string[] | null;
  // On the account screen, the teaser takes the preview's place (154k, 175i).
  teaser: ReactNode;
  // A sample isn't made from the answers, so it says it's written for anyone (155g).
  forAnyone: boolean;
  onTryAgain: () => void;
}

const capitalised = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

// Designs 175a–175i, the right-hand side on a wide screen: the overview taking shape beside the
// questions. Before writing it lists what writing waits on, with the step the screen feeds marked;
// once writing starts the bar appears over the kind's sections. Sections are drawn, never their
// text, so nothing can be read before an account.
export function OnboardingPreview({
  progress,
  phase,
  kind,
  found,
  failure,
  answers,
  sortedInto,
  teaser,
  forAnyone,
  onTryAgain,
}: OnboardingPreviewProps) {
  const card = found !== null && kind !== null ? <OnboardingSourceCard kind={kind} found={found} size="small" /> : null;
  const body = (() => {
    if (teaser !== null) return teaser;
    if (failure === "fetch" || kind === null) {
      return (
        <>
          <Head role="status">Nothing to make yet</Head>
          <p className={styles.empty}>It takes shape here once we have a link we can read.</p>
        </>
      );
    }
    if (failure === "write") {
      return (
        <>
          <Head role="alert">Couldn't make your overview</Head>
          {card}
          <div className={styles.failure}>
            <span className={styles.alert}>
              <StrokeIcon name="alert" size={16} />
            </span>
            <span className={styles.failureText}>Something went wrong while writing. Your answers are kept.</span>
            <button type="button" className={styles.tryAgain} onClick={onTryAgain} data-testid={onboardingPreviewTestIds.tryAgain}>
              <StrokeIcon name="refresh" size={14} />
              Try again
            </button>
          </div>
        </>
      );
    }
    if (phase === "fetching" || phase === "waiting") {
      const ready = phase === "waiting" ? kind.ready(found) : null;
      return (
        <>
          <Head role="status">{ready === null ? `${kind.fetching}…` : `${ready}. ${writingStarts(answers.soon)}.`}</Head>
          {answers.current !== "source" && card !== null && <div className={styles.arriving}>{card}</div>}
          <OnboardingPreviewSteps
            noun={capitalised(kind.noun("video", found))}
            fetching={kind.fetching}
            ready={ready}
            current={answers.current}
            topics={answers.topics}
            topicsAnswered={answers.topicsAnswered}
            personal={answers.personal}
            soon={answers.soon}
          />
        </>
      );
    }
    return (
      <>
        {progress}
        {card}
        {!forAnyone && <MadeWith answers={answers} />}
        <Sections kind={kind} found={found} written={phase === "ready"} sortedInto={sortedInto} />
        {forAnyone && (
          <p className={styles.forAnyone} data-testid={onboardingPreviewTestIds.forAnyone}>
            Written for anyone. The overviews you make are written for you.
          </p>
        )}
      </>
    );
  })();
  return (
    <aside className={styles.root} aria-label="Your overview" data-testid={onboardingPreviewTestIds.root}>
      {body}
    </aside>
  );
}

function Head({ role, children }: { role: "status" | "alert"; children: ReactNode }) {
  return (
    <div className={styles.head}>
      <span className={styles.kicker}>Your overview</span>
      <p
        className={styles.status}
        role={role}
        aria-live={role === "status" ? "polite" : undefined}
        data-testid={onboardingPreviewTestIds.status}
      >
        {children}
      </p>
    </div>
  );
}

// 175e: what the answers gave it, folded into one line as writing starts.
function MadeWith({ answers }: { answers: OnboardingPreviewAnswers }) {
  const topics = answers.topics.length;
  return (
    <p className={styles.madeWith} data-testid={onboardingPreviewTestIds.madeWith}>
      <span className={styles.pill}>{topics === 0 ? "No topics yet" : topics === 1 ? "1 topic" : `${topics} topics`}</span>
      <span className={answers.personal ? styles.pillOn : styles.pill}>{answers.personal ? "Personalised" : "Written for anyone"}</span>
      <span className={styles.pill}>{answers.voice} voice</span>
    </p>
  );
}

function Sections({
  kind,
  found,
  written,
  sortedInto,
}: {
  kind: OnboardingSource;
  found: OnboardingFound | null;
  written: boolean;
  sortedInto: readonly string[] | null;
}) {
  return (
    <ul className={styles.sections} aria-label="Sections">
      {kind.sections(found).map(({ name, fromPage }) => {
        const shown = written ? "written" : fromPage && found !== null ? "fromPage" : "writing";
        return (
          <li key={name} className={styles.section} data-testid={onboardingPreviewTestIds.section(name)} data-state={shown}>
            <span className={styles.sectionHead}>
              {name}
              {shown === "written" ? (
                <span className={styles.written}>
                  <StrokeIcon name="check" size={12} />
                  Written
                </span>
              ) : shown === "fromPage" ? (
                <span className={styles.written}>
                  <StrokeIcon name="check" size={12} />
                  From the page
                </span>
              ) : (
                <span className={styles.writing}>Writing</span>
              )}
            </span>
            <span className={styles.bars} aria-hidden="true">
              <span className={styles.bar} />
              <span className={styles.bar} style={{ width: "64%" }} />
            </span>
          </li>
        );
      })}
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
  );
}
