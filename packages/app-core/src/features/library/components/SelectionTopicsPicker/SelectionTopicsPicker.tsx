import type { Topic, TopicId } from "@overview/domain";
import { ChecklistPicker } from "../../../../components/shared/ChecklistPicker/ChecklistPicker.js";
import {
  checklistOptionState,
  sharedChecklistFoot,
  sharedChecklistHint,
} from "../../../../components/shared/ChecklistPicker/checklistOptionState.js";
import type { OverviewWithState } from "../../../overviews/types/OverviewWithState.js";
import { selectionTopicsPickerTestIds } from "./SelectionTopicsPickerTestIds.js";

export interface SelectionTopicsPickerProps {
  topics: Topic[];
  overviews: OverviewWithState[];
  countByTopic: Record<string, number>;
  onToggle: (topicId: TopicId, give: boolean) => void;
  onCreate: (name: string) => void;
  onClose: () => void;
}

// Topics for the selection, in bulk: Edit topics in ⋯ does it one overview at a time
// ("OV-168 5" 168as).
export function SelectionTopicsPicker({ topics, overviews, countByTopic, onToggle, onCreate, onClose }: SelectionTopicsPickerProps) {
  const of = overviews.length;
  const options = topics.map((topic) => {
    const held = overviews.filter(({ overview }) => overview.topicIds.includes(topic.id)).length;
    return {
      id: topic.id,
      name: topic.name,
      detail: held > 0 && held < of ? `${held} of ${of} have it` : null,
      count: countByTopic[topic.id] ?? 0,
      state: checklistOptionState(held, of),
      held,
    };
  });

  return (
    <ChecklistPicker
      heading={`Topics for ${of} ${of === 1 ? "overview" : "overviews"}`}
      hint={sharedChecklistHint}
      groupLabel="Topics"
      findPlaceholder="Find a topic"
      options={options}
      onToggle={(id, give) => onToggle(id as TopicId, give)}
      newLabel="New topic…"
      onNew={{ placeholder: "Name the topic", refusal: () => null, onCreate }}
      foot={sharedChecklistFoot(options, of, "No topics on these yet")}
      onClose={onClose}
      testIds={selectionTopicsPickerTestIds}
    />
  );
}
