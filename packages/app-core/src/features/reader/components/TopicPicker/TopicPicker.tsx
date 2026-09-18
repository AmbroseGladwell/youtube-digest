import { forwardRef, useEffect, useRef, useState } from "react";
import type { Topic, TopicId } from "@overview/types";
import { creatableTopicName, topicMatches } from "../../../overviews/util/topicMatches.js";
import styles from "./TopicPicker.module.scss";
import { topicPickerTestIds } from "./TopicPickerTestIds.js";

export interface TopicPickerProps {
  topics: Topic[];
  selected: Topic[];
  countByTopic: Record<string, number>;
  busy: boolean;
  onToggle: (topicId: TopicId) => void;
  onCreate: (name: string) => void;
  onClose: () => void;
}

const HEADING_ID = "TopicPicker-heading";

export const TopicPicker = forwardRef<HTMLDivElement, TopicPickerProps>(function TopicPicker(
  { topics, selected, countByTopic, busy, onToggle, onCreate, onClose },
  ref,
) {
  const [query, setQuery] = useState("");
  const search = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    search.current?.focus();
  }, []);

  const matches = topicMatches(topics, query);
  const creatable = creatableTopicName(topics, query);
  const selectedIds = new Set(selected.map((topic) => topic.id));

  const create = () => {
    if (creatable === null) {
      return;
    }
    onCreate(creatable);
    setQuery("");
  };

  return (
    <div
      ref={ref}
      className={styles.root}
      role="dialog"
      aria-labelledby={HEADING_ID}
      aria-busy={busy}
      data-testid={topicPickerTestIds.root}
    >
      <span className={styles.handle} aria-hidden="true" />

      <div className={styles.sheetHead}>
        <span className={styles.sheetTitle} id={HEADING_ID}>
          Edit topics
        </span>
        <button
          type="button"
          className={styles.done}
          onClick={onClose}
          data-testid={topicPickerTestIds.doneButton}
        >
          Done
        </button>
      </div>

      {selected.length > 0 && (
        <div className={styles.sheetChips}>
          {selected.map((topic) => (
            <span
              key={topic.id}
              className={styles.sheetChip}
              data-testid={topicPickerTestIds.sheetChip(topic.name)}
            >
              {topic.name}
              <button
                type="button"
                className={styles.removeChip}
                onClick={() => onToggle(topic.id)}
                aria-label={`Remove ${topic.name}`}
                data-testid={topicPickerTestIds.removeSheetChip(topic.name)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className={styles.searchRow}>
        <input
          ref={search}
          type="search"
          className={styles.search}
          value={query}
          placeholder="Search or create a topic"
          aria-label="Search or create a topic"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              create();
            }
          }}
          data-testid={topicPickerTestIds.searchInput}
        />
      </div>

      <div className={styles.list}>
        {creatable !== null && (
          <button
            type="button"
            className={styles.createOption}
            onClick={create}
            disabled={busy}
            data-testid={topicPickerTestIds.createOption}
          >
            <span>
              + Create “<strong>{creatable}</strong>”
            </span>
            <span className={styles.newMark}>New</span>
          </button>
        )}

        {matches.length > 0 && <p className={styles.listKicker}>Your topics</p>}

        {matches.map(({ topic, before, matched, after }) => (
          <button
            key={topic.id}
            type="button"
            className={styles.option}
            onClick={() => onToggle(topic.id)}
            aria-pressed={selectedIds.has(topic.id)}
            disabled={busy}
            data-testid={topicPickerTestIds.option(topic.name)}
          >
            <span className={styles.optionName}>
              {selectedIds.has(topic.id) && (
                <span className={styles.tick} aria-hidden="true">
                  ✓
                </span>
              )}
              {before}
              <strong>{matched}</strong>
              {after}
            </span>
            <span className={styles.count} data-testid={topicPickerTestIds.optionCount}>
              {countByTopic[topic.id] ?? 0}
            </span>
          </button>
        ))}

        {matches.length === 0 && creatable === null && (
          <p className={styles.empty} data-testid={topicPickerTestIds.empty}>
            No topics yet. Type a name to make one.
          </p>
        )}
      </div>

      <p className={styles.note}>Saves as you pick — an overview can sit in several topics. Esc closes.</p>
    </div>
  );
});
