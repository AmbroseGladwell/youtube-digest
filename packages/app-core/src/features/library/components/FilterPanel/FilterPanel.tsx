import type { ReactNode } from "react";
import type { Novelty, Topic } from "@overview/types";
import { NOVELTY_LABEL, NOVELTY_ORDER } from "../../../overviews/noveltyLabel.js";
import type { LibraryFilters } from "../../types/LibraryFilters.js";
import styles from "./FilterPanel.module.scss";
import { filterPanelTestIds } from "./FilterPanelTestIds.js";

export interface FilterPanelProps {
  filters: LibraryFilters;
  topics: Topic[];
  onChange: (patch: Partial<LibraryFilters>) => void;
}

const STATUS_LABEL: Record<LibraryFilters["status"], string> = {
  all: "Any status",
  unread: "Unread",
  read: "Read",
};

export function FilterPanel({ filters, topics, onChange }: FilterPanelProps) {
  return (
    <div className={styles.root} data-testid={filterPanelTestIds.root}>
      <input
        type="search"
        className={styles.searchInput}
        placeholder="Search claims, channels, tags, actions"
        value={filters.query}
        onChange={(event) => onChange({ query: event.target.value })}
        aria-label="Search overviews"
        data-testid={filterPanelTestIds.searchInput}
      />

      {topics.length > 0 && (
        <div className={styles.chipRow} role="group" aria-label="Filter by topic">
          <Chip
            active={filters.topicId === "all"}
            onClick={() => onChange({ topicId: "all" })}
            testId={filterPanelTestIds.topicChip("all")}
          >
            Any topic
          </Chip>
          {topics.map((topic) => (
            <Chip
              key={topic.id}
              active={filters.topicId === topic.id}
              onClick={() => onChange({ topicId: topic.id })}
              testId={filterPanelTestIds.topicChip(topic.id)}
            >
              {topic.name}
            </Chip>
          ))}
        </div>
      )}

      <div className={styles.chipRow} role="group" aria-label="Filter by verdict">
        <Chip
          active={filters.novelty === "all"}
          onClick={() => onChange({ novelty: "all" })}
          testId={filterPanelTestIds.noveltyChip("all")}
        >
          Any verdict
        </Chip>
        {NOVELTY_ORDER.map((novelty: Novelty) => (
          <Chip
            key={novelty}
            active={filters.novelty === novelty}
            onClick={() => onChange({ novelty })}
            testId={filterPanelTestIds.noveltyChip(novelty)}
          >
            {NOVELTY_LABEL[novelty]}
          </Chip>
        ))}
      </div>

      <div className={styles.chipRow} role="group" aria-label="Filter by read status">
        {(Object.keys(STATUS_LABEL) as LibraryFilters["status"][]).map((status) => (
          <Chip
            key={status}
            active={filters.status === status}
            onClick={() => onChange({ status })}
            testId={filterPanelTestIds.statusChip(status)}
          >
            {STATUS_LABEL[status]}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  testId,
  children,
}: {
  active: boolean;
  onClick: () => void;
  testId: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`${styles.chip} ${active ? styles.chipActive : ""}`}
      onClick={onClick}
      aria-pressed={active}
      data-testid={testId}
    >
      {children}
    </button>
  );
}
