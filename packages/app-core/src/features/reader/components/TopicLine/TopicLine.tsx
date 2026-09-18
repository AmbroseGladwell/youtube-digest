import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Overview, TopicId } from "@overview/types";
import { useCreateTopicMutation } from "../../../overviews/mutations/useCreateTopicMutation.js";
import { useSetOverviewTopicsMutation } from "../../../overviews/mutations/useSetOverviewTopicsMutation.js";
import { useOverviewsWithStateQuery } from "../../../overviews/queries/overviewsWithStateQuery.js";
import { useTopicsQuery } from "../../../overviews/queries/topicsQuery.js";
import { topicCounts } from "../../../overviews/util/topicCounts.js";
import { useIsPhone } from "../../../../util/useIsPhone.js";
import { TopicPicker } from "../TopicPicker/TopicPicker.js";
import styles from "./TopicLine.module.scss";
import { topicLineTestIds } from "./TopicLineTestIds.js";

export interface TopicLineProps {
  overview: Overview;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}

// The phone's sheet is fixed to the window, and AppShell's pane carries a
// view-transition-name, which makes it the containing block every fixed descendant
// resolves against. The sheet therefore leaves the subtree; the popover, positioned
// against the line itself, does not (docs/features/topic-filing.md).
const sheet = (isPhone: boolean, content: ReactNode) =>
  isPhone ? createPortal(content, document.body) : content;

// Design 14a/14b/14c: reading, this is the topics the overview is in and nothing else. The
// editing half is disclosed by the picker, so the line is editable exactly while the picker
// is open (docs/features/topic-filing.md).
export function TopicLine({ overview, editing, onEditingChange }: TopicLineProps) {
  const topicsQuery = useTopicsQuery();
  const libraryQuery = useOverviewsWithStateQuery();
  const setOverviewTopics = useSetOverviewTopicsMutation();
  const createTopic = useCreateTopicMutation();
  const root = useRef<HTMLDivElement | null>(null);
  const picker = useRef<HTMLDivElement | null>(null);
  const isPhone = useIsPhone();

  const close = () => onEditingChange(false);

  useEffect(() => {
    if (!editing) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!root.current?.contains(target) && !picker.current?.contains(target)) {
        close();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [editing]);

  const topics = topicsQuery.data ?? [];
  const selected = topics.filter((topic) => overview.topicIds.includes(topic.id));
  const counts = topicCounts((libraryQuery.data ?? []).map((entry) => entry.overview));
  const busy = setOverviewTopics.isPending || createTopic.isPending;

  const toggle = (topicId: TopicId) =>
    setOverviewTopics.mutate({
      overview,
      topicIds: overview.topicIds.includes(topicId)
        ? overview.topicIds.filter((id) => id !== topicId)
        : [...overview.topicIds, topicId],
    });

  if (selected.length === 0 && !editing) {
    return null;
  }

  return (
    <span className={styles.root} ref={root} data-testid={topicLineTestIds.root}>
      {selected.map((topic) => (
        <span key={topic.id} className={styles.chip} data-testid={topicLineTestIds.chip}>
          {topic.name}
          {editing && (
            <button
              type="button"
              className={styles.removeChip}
              onClick={() => toggle(topic.id)}
              aria-label={`Remove ${topic.name}`}
              data-testid={topicLineTestIds.removeChip(topic.name)}
            >
              ×
            </button>
          )}
        </span>
      ))}

      {editing && (
        <>
          <button
            type="button"
            className={styles.add}
            onClick={close}
            aria-expanded={true}
            data-testid={topicLineTestIds.addButton}
          >
            + Add
          </button>
          {sheet(
            isPhone,
            <>
              <span
                className={styles.scrim}
                onClick={close}
                aria-hidden="true"
                data-testid={topicLineTestIds.scrim}
              />
              <TopicPicker
                ref={picker}
                topics={topics}
                selected={selected}
                countByTopic={counts}
                busy={busy}
                onToggle={toggle}
                onCreate={(name) => createTopic.mutate({ name, overviews: [overview] })}
                onClose={close}
              />
            </>,
          )}
        </>
      )}
    </span>
  );
}
