import { useState } from "react";
import type { Novelty, Topic } from "@overview/domain";
import { NOVELTY_LABEL, NOVELTY_ORDER } from "../../../overviews/noveltyLabel.js";
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

export function FilterPanel({ filters, topics, counts, onChange, onNewTopic }: FilterPanelProps) {
  const [allTopicsShown, setAllTopicsShown] = useState(false);
  const capped = cappedTopics(topics, filters.topicId);
  const shownTopics = allTopicsShown ? topics : capped.shown;

  return (
    <div className={styles.root} data-testid={filterPanelTestIds.root}>
      <input
        type="search"
        className={styles.searchInput}
        placeholder="Search claims, channels, tags"
        value={filters.query}
        onChange={(event) => onChange({ query: event.target.value })}
        aria-label="Search overviews"
        data-testid={filterPanelTestIds.searchInput}
      />

      <p className={styles.kicker}>Show</p>
      <div className={styles.toggleRow}>
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

      <p className={styles.kicker}>Topic</p>
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
        + New topic
      </button>

      <p className={styles.kicker}>Verdict</p>
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
          ⚠ Dubious only
        </ListOption>
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
      className={`${styles.toggle} ${active ? styles.toggleActive : ""}`}
      onClick={onClick}
      aria-pressed={active}
      data-testid={testId}
    >
      {active && <span aria-hidden="true">✓</span>}
      {children}
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
      className={`${styles.option} ${active ? styles.optionActive : ""} ${accent ? styles.optionAccent : ""}`}
      onClick={onClick}
      aria-pressed={active}
      data-testid={testId}
    >
      <span className={styles.optionLabel}>{children}</span>
      <span className={styles.count}>{count}</span>
    </button>
  );
}
