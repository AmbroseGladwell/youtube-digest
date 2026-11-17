import { useEffect, useRef, type RefObject } from "react";
import { NOVELTY_LABEL, sourceName } from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { KindChip } from "../../../../components/shared/KindChip/KindChip.js";
import { OverviewThumbnail } from "../../../../components/shared/OverviewThumbnail/OverviewThumbnail.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import type { OverviewWithState } from "../../../overviews/types/OverviewWithState.js";
import styles from "./ProjectSuggestions.module.scss";
import { projectSuggestionsTestIds } from "./ProjectSuggestionsTestIds.js";

export type SuggestionPhase = "shown" | "leaving" | "closing";

export interface SuggestionRow {
  entry: OverviewWithState;
  phase: SuggestionPhase;
  topicNames: string[];
}

export interface ProjectSuggestionsProps {
  id: string;
  projectName: string;
  hasPurpose: boolean;
  rows: SuggestionRow[];
  closing: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  focusAdd: string | null;
  onFocused: () => void;
  onAdd: (entry: OverviewWithState) => void;
  onAddAll: () => void;
  onTurnDown: (entry: OverviewWithState) => void;
  onOpen: () => void;
  onAddPurpose: () => void;
}

// Saved overviews that might fit a project, found by meaning from its name and what it's for:
// lighter than a library row, still an overview ("OV-318 3" 318m, 318n).
export function ProjectSuggestions({
  id,
  projectName,
  hasPurpose,
  rows,
  closing,
  headingRef,
  focusAdd,
  onFocused,
  onAdd,
  onAddAll,
  onTurnDown,
  onOpen,
  onAddPurpose,
}: ProjectSuggestionsProps) {
  const addButtons = useRef(new Map<string, HTMLButtonElement>());
  const offered = rows.filter((row) => row.phase === "shown");

  useEffect(() => {
    if (focusAdd === null) return;
    addButtons.current.get(focusAdd)?.focus({ preventScroll: true });
    onFocused();
  }, [focusAdd]);

  return (
    <div className={styles.collapse} data-closing={closing || undefined}>
      <section id={id} className={styles.root} aria-labelledby={`${id}-heading`} data-testid={projectSuggestionsTestIds.root}>
        <div className={styles.head}>
          <h2
            id={`${id}-heading`}
            ref={headingRef}
            tabIndex={-1}
            className={styles.heading}
            data-testid={projectSuggestionsTestIds.heading}
          >
            <StrokeIcon name="sparkle" size={14} />
            Overviews that might fit
          </h2>
          {offered.length > 1 && (
            <button
              type="button"
              className={styles.pill}
              onClick={onAddAll}
              aria-label={`Add all ${offered.length} to ${projectName}`}
              data-testid={projectSuggestionsTestIds.addAllButton}
            >
              <StrokeIcon name="plus" size={14} />
              Add all {offered.length}
            </button>
          )}
        </div>
        <p className={styles.subline} data-testid={projectSuggestionsTestIds.subline}>
          {hasPurpose ? (
            "Found by meaning, from the project’s name and what it’s for."
          ) : (
            <>
              Found by meaning from the project’s name.{" "}
              <button
                type="button"
                className={styles.inlineLink}
                onClick={onAddPurpose}
                data-testid={projectSuggestionsTestIds.addPurposeLink}
              >
                Saying what it’s for
              </button>{" "}
              makes suggestions more accurate.
            </>
          )}
        </p>
        <ul className={styles.list}>
          {rows.map(({ entry, phase, topicNames }) => {
            const { overview } = entry;
            const title = overview.source.title;
            return (
              <li key={overview.id} className={styles.rowCollapse} data-phase={phase} inert={phase !== "shown"}>
                <div className={styles.rowClip}>
                  <div className={styles.row} data-testid={projectSuggestionsTestIds.row}>
                    <OverviewThumbnail
                      video={overview.source}
                      to={Routes.overview(overview.id)}
                      onOpen={onOpen}
                      className={styles.thumbnail}
                    />
                    <div className={styles.body}>
                      <p className={styles.kicker}>
                        <KindChip overview={overview} />
                        {topicNames.map((name) => (
                          <span key={name} className={styles.topic}>
                            {name}
                          </span>
                        ))}
                        {overview.verdict && <span className={styles.verdict}>{NOVELTY_LABEL[overview.verdict.novelty]}</span>}
                      </p>
                      <PageLink
                        className={styles.title}
                        to={Routes.overview(overview.id)}
                        onClick={onOpen}
                        data-testid={projectSuggestionsTestIds.titleLink}
                      >
                        {title}
                      </PageLink>
                      <p className={styles.line}>
                        <span className={styles.source}>{sourceName(overview.source)}</span> · {overview.inOneLine}
                      </p>
                    </div>
                    <div className={styles.actions}>
                      <button
                        type="button"
                        ref={(button) => {
                          if (button === null) addButtons.current.delete(overview.id);
                          else addButtons.current.set(overview.id, button);
                        }}
                        className={styles.pill}
                        onClick={() => onAdd(entry)}
                        aria-label={`Add ${title} to ${projectName}`}
                        data-testid={projectSuggestionsTestIds.addButton}
                      >
                        <StrokeIcon name="plus" size={14} />
                        Add
                      </button>
                      <button
                        type="button"
                        className={styles.turnDown}
                        onClick={() => onTurnDown(entry)}
                        aria-label={`Not for ${projectName}: ${title}`}
                        title="Not for this project"
                        data-testid={projectSuggestionsTestIds.turnDownButton}
                      >
                        <StrokeIcon name="close" size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
