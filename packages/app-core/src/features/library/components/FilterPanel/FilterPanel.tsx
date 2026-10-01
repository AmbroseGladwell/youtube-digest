import { useState } from "react";
import { NOVELTY_LABEL, NOVELTY_ORDER, type Novelty, type Topic } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import type { LibraryFilterCounts } from "../../util/libraryFilterCounts.js";
import type { LibraryFilters } from "../../types/LibraryFilters.js";
import { cappedTopics } from "../../util/cappedTopics.js";
import styles from "./FilterPanel.module.scss";
import { filterPanelTestIds } from "./FilterPanelTestIds.js";

export interface FilterPanelProps {
  filters: LibraryFilters;
  topics: Topic[];
  counts: LibraryFilterCounts;
  onChange: (patch: Partial<LibraryFilters>) => void;
  onNewTopic: () => void;
}

const MORE_PANEL_ID = "FilterPanel-more";

// Closed, the row still says what is set, so a hidden filter is never a surprise
// ("OV-34 2 Milestones" 34ab).
const verdictSummary = (filters: LibraryFilters): string => {
  const parts = [
    ...(filters.novelty === "all" ? [] : [NOVELTY_LABEL[filters.novelty]]),
    ...(filters.dubious ? ["Dubious only"] : []),
  ];
  return parts.length === 0 ? "Any verdict" : parts.join(" · ");
};

export function FilterPanel({ filters, topics, counts, onChange, onNewTopic }: FilterPanelProps) {
  const [allTopicsShown, setAllTopicsShown] = useState(false);
  const [moreShown, setMoreShown] = useState(false);
  const capped = cappedTopics(topics, filters.topicId);
  const shownTopics = allTopicsShown ? topics : capped.shown;

  return (
    <div className={styles.root} data-testid={filterPanelTestIds.root}>
      <div className={styles.group}>
        <p className={styles.label}>Show</p>
        <Toggle
          active={filters.status === "unread"}
          count={counts.unread}
          onClick={() => onChange({ status: filters.status === "unread" ? "all" : "unread" })}
          testId={filterPanelTestIds.statusChip("unread")}
        >
          Unread only
        </Toggle>
        <Toggle
          active={filters.favourite}
          count={counts.favourite}
          onClick={() => onChange({ favourite: !filters.favourite })}
          testId={filterPanelTestIds.favouriteChip}
        >
          Only favourites
        </Toggle>
      </div>

      <div className={styles.group}>
        <p className={styles.label}>Topic</p>
        {topics.length > 0 && (
          <div className={styles.list} role="group" aria-label="Filter by topic">
            <ListOption
              active={filters.topicId === "all"}
              count={counts.total}
              onClick={() => onChange({ topicId: "all" })}
              testId={filterPanelTestIds.topicChip("all")}
            >
              All topics
            </ListOption>
            {shownTopics.map((topic) => (
              <ListOption
                key={topic.id}
                active={filters.topicId === topic.id}
                count={counts.byTopic[topic.id] ?? 0}
                onClick={() => onChange({ topicId: topic.id })}
                testId={filterPanelTestIds.topicChip(topic.id)}
              >
                {topic.name}
              </ListOption>
            ))}
          </div>
        )}
        {capped.hiddenCount > 0 && (
          <button
            type="button"
            className={styles.moreTopics}
            onClick={() => setAllTopicsShown(!allTopicsShown)}
            aria-expanded={allTopicsShown}
            data-testid={filterPanelTestIds.showAllTopicsButton}
          >
            {allTopicsShown ? "Show fewer" : `Show all ${topics.length} topics`}
          </button>
        )}
        <button
          type="button"
          className={styles.newTopic}
          onClick={onNewTopic}
          data-testid={filterPanelTestIds.newTopicButton}
        >
          <StrokeIcon name="plus" />
          New topic
        </button>
      </div>

      <div className={styles.more}>
        <button
          type="button"
          className={styles.moreButton}
          onClick={() => setMoreShown(!moreShown)}
          aria-expanded={moreShown}
          aria-controls={MORE_PANEL_ID}
          data-testid={filterPanelTestIds.moreFiltersButton}
        >
          <span>More filters</span>
          <span className={styles.moreSummary}>
            <span data-testid={filterPanelTestIds.moreFiltersSummary}>{verdictSummary(filters)}</span>
            <span className={`${styles.chevron} ${moreShown ? styles.chevronOpen : ""}`} aria-hidden="true">
              <StrokeIcon name="chevronDown" size={14} />
            </span>
          </span>
        </button>
        <div id={MORE_PANEL_ID} className={`${styles.morePanel} ${moreShown ? styles.morePanelOpen : ""}`} inert={!moreShown}>
          <div className={styles.morePanelInner}>
            <p className={styles.label}>Verdict</p>
            <div className={styles.list} role="group" aria-label="Filter by verdict">
              <ListOption
                active={filters.novelty === "all"}
                count={counts.total}
                onClick={() => onChange({ novelty: "all" })}
                testId={filterPanelTestIds.noveltyChip("all")}
              >
                Any verdict
              </ListOption>
              {NOVELTY_ORDER.map((novelty: Novelty) => (
                <ListOption
                  key={novelty}
                  active={filters.novelty === novelty}
                  count={counts.byNovelty[novelty] ?? 0}
                  onClick={() => onChange({ novelty })}
                  testId={filterPanelTestIds.noveltyChip(novelty)}
                >
                  {NOVELTY_LABEL[novelty]}
                </ListOption>
              ))}
              <ListOption
                active={filters.dubious}
                count={counts.dubious}
                accent
                onClick={() => onChange({ dubious: !filters.dubious })}
                testId={filterPanelTestIds.dubiousChip}
              >
                Dubious only
              </ListOption>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Toggle({
  active,
  count,
  onClick,
  testId,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  testId: string;
  children: string;
}) {
  return (
    <button
      type="button"
      className={`${styles.option} ${styles.toggle}`}
      onClick={onClick}
      aria-pressed={active}
      data-testid={testId}
    >
      <span className={styles.optionLabel}>
        <span className={`${styles.box} ${active ? styles.boxChecked : ""}`} aria-hidden="true">
          {active && <StrokeIcon name="check" size={11} />}
        </span>
        {children}
      </span>
      <span className={styles.count}>{count}</span>
    </button>
  );
}

function ListOption({
  active,
  count,
  accent,
  onClick,
  testId,
  children,
}: {
  active: boolean;
  count: number;
  accent?: boolean;
  onClick: () => void;
  testId: string;
  children: string;
}) {
  return (
    <button
      type="button"
      className={`${styles.option} ${active ? styles.optionActive : ""}`}
      onClick={onClick}
      aria-pressed={active}
      data-testid={testId}
    >
      <span className={styles.optionLabel}>
        {accent && (
          <span className={styles.accentMark} aria-hidden="true">
            <StrokeIcon name="alert" size={13} />
          </span>
        )}
        {children}
      </span>
      <span className={styles.count}>{count}</span>
    </button>
  );
}
