import type { ReactNode } from "react";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import type { OnboardingFound, OnboardingSource } from "../../onboardingSources.js";
import type { OnboardingRunPhase } from "../../useOnboardingRun.js";
import { OnboardingSourceCard } from "../OnboardingSourceCard/OnboardingSourceCard.js";
import styles from "./OnboardingPreview.module.scss";
import { onboardingPreviewTestIds } from "./OnboardingPreviewTestIds.js";

export interface OnboardingPreviewProps {
  progress: ReactNode;
  phase: OnboardingRunPhase;
  kind: OnboardingSource | null;
  link: string;
  found: OnboardingFound | null;
  // A page that couldn't be used leaves nothing to preview until another link is given.
  unusable: boolean;
  // The topics it was sorted into, once it is written; an empty list is Unsorted.
  sortedInto: readonly string[] | null;
  // On the account screen, the teaser takes the preview's place (154k).
  teaser: ReactNode;
}

// Designs 46d and 154h, the right-hand side on a wide screen: the overview taking shape beside
// the questions. Its card is the confirm card made small, and its sections are the kind's.
// Sections are drawn, never their text, so nothing can be read before an account; each says only
// what the run is known to be doing, and what a recipe takes from the page is known once it's read.
export function OnboardingPreview({ progress, phase, kind, link, found, unusable, sortedInto, teaser }: OnboardingPreviewProps) {
  if (unusable) {
    return (
      <aside className={styles.root} aria-label="Your overview" data-testid={onboardingPreviewTestIds.root}>
        <p className={styles.empty}>Your first overview takes shape here once we have a link we can read.</p>
      </aside>
    );
  }
  const pending = found === null ? (kind?.pending(link) ?? null) : null;
  const state = phase === "ready" ? "written" : phase === "writing" ? "writing" : "waiting";
  return (
    <aside className={styles.root} aria-label="Your overview" data-testid={onboardingPreviewTestIds.root}>
      {progress}
      {teaser ?? (
        <>
          {found !== null && kind !== null && <OnboardingSourceCard kind={kind} found={found} size="small" />}
          {pending !== null ? (
            <div className={styles.pending}>
              <span className={styles.domain}>{pending}</span>
              <p className={styles.empty}>Its sections show here once we know what the page is.</p>
            </div>
          ) : (
            <ul className={styles.sections} aria-label="Sections">
              {(kind?.sections(found) ?? []).map(({ name, fromPage }) => {
                const shown = state === "written" ? "written" : fromPage && found !== null ? "fromPage" : state;
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
                      ) : shown === "writing" ? (
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
          )}
        </>
      )}
    </aside>
  );
}
