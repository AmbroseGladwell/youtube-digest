import { useRef } from "react";
import { createPortal } from "react-dom";
import type { Overview, TopicId } from "@overview/domain";
import { useCreateTopicMutation } from "../../../overviews/mutations/useCreateTopicMutation.js";
import { useSetOverviewTopicsMutation } from "../../../overviews/mutations/useSetOverviewTopicsMutation.js";
import { useOverviewsWithStateQuery } from "../../../overviews/queries/overviewsWithStateQuery.js";
import { readableEntries } from "../../../overviews/types/LibraryEntry.js";
import { useTopicsQuery } from "../../../overviews/queries/topicsQuery.js";
import { topicCounts } from "../../../overviews/util/topicCounts.js";
import { useDismissOnOutside } from "../../../../util/useDismissOnOutside.js";
import { useIsPhone } from "../../../../util/useIsPhone.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useReaderAnalytics } from "../../../analytics/OverviewAnalyticsContext.js";
import { TopicPicker } from "../TopicPicker/TopicPicker.js";
import { topicPickerTestIds } from "../TopicPicker/TopicPickerTestIds.js";
import { BottomSheet } from "../../../../components/shared/BottomSheet/BottomSheet.js";
import styles from "./TopicLine.module.scss";
import { topicLineTestIds } from "./TopicLineTestIds.js";

export interface TopicLineProps {
  overview: Overview;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}

export const TopicLine = ({ overview, editing, onEditingChange }: TopicLineProps) => {
  const topicsQuery = useTopicsQuery();
  const libraryQuery = useOverviewsWithStateQuery();
  const setOverviewTopics = useSetOverviewTopicsMutation();
  const createTopic = useCreateTopicMutation();
  const root = useRef<HTMLDivElement | null>(null);
  const picker = useRef<HTMLDivElement | null>(null);
  const search = useRef<HTMLInputElement | null>(null);
  const addButton = useRef<HTMLButtonElement | null>(null);
  const isPhone = useIsPhone();
  const analytics = useReaderAnalytics();

  const close = () => {
    analytics.topics.pickerClosed();
    onEditingChange(false);
  };

  useDismissOnOutside(editing && !isPhone, close, root, picker);

  const topics = topicsQuery.data ?? [];
  const selected = topics.filter((topic) => overview.topicIds.includes(topic.id));
  const counts = topicCounts(readableEntries(libraryQuery.data ?? []).map((entry) => entry.overview));
  const busy = setOverviewTopics.isPending || createTopic.isPending;

  const toggle = (topicId: TopicId) => {
    if (overview.topicIds.includes(topicId)) {
      analytics.topics.removed({ topicId });
    } else {
      analytics.topics.added({ topicId });
    }
    setOverviewTopics.mutate({
      overview,
      topicIds: overview.topicIds.includes(topicId) ? overview.topicIds.filter((id) => id !== topicId) : [...overview.topicIds, topicId],
    });
  };

  const pickerProps = {
    topics,
    selected,
    countByTopic: counts,
    busy,
    onToggle: toggle,
    onCreate: (name: string) => {
      analytics.topics.created();
      createTopic.mutate({ name, overviews: [overview] });
    },
    onClose: close,
  };
  // Design 14c on a phone: the shared sheet, kept in the tree so it can leave as it arrived.
  const phoneSheet =
    isPhone &&
    createPortal(
      <BottomSheet
        open={editing}
        title="Edit topics"
        onClose={close}
        initialFocus={search}
        returnFocusTo={addButton.current}
        testId={topicLineTestIds.sheet}
        foot={
          <button type="button" className={styles.sheetDone} onClick={close} data-testid={topicPickerTestIds.doneButton}>
            Done
          </button>
        }
      >
        <TopicPicker ref={picker} inSheet searchRef={search} {...pickerProps} />
      </BottomSheet>,
      document.body,
    );

  if (selected.length === 0 && !editing) {
    return phoneSheet || null;
  }

  return (
    <span className={styles.root} ref={root} data-testid={topicLineTestIds.root}>
      {selected.map((topic) => (
        <span key={topic.id} className={`${styles.chip} ${editing ? styles.chipEditing : ""}`} data-testid={topicLineTestIds.chip}>
          {topic.name}
          {editing && (
            <button
              type="button"
              className={styles.removeChip}
              onClick={() => toggle(topic.id)}
              aria-label={`Remove ${topic.name}`}
              data-testid={topicLineTestIds.removeChip(topic.name)}
            >
              <StrokeIcon name="close" size={11} />
            </button>
          )}
        </span>
      ))}

      {editing && (
        <>
          <button
            type="button"
            ref={addButton}
            className={styles.add}
            onClick={close}
            aria-expanded={true}
            data-testid={topicLineTestIds.addButton}
          >
            <StrokeIcon name="plus" size={12} /> Add
          </button>
          {!isPhone && <TopicPicker ref={picker} {...pickerProps} />}
        </>
      )}
      {phoneSheet}
    </span>
  );
};
