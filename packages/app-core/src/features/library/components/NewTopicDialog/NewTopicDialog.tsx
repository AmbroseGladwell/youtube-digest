import { useId, useState } from "react";
import { type OverviewId, type Overview, sourceName } from "@overview/domain";
import { BottomSheet } from "../../../../components/shared/BottomSheet/BottomSheet.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./NewTopicDialog.module.scss";
import { newTopicDialogTestIds } from "./NewTopicDialogTestIds.js";

export interface OnCreateOptions {
  name: string;
  overviews: Overview[];
}

export interface NewTopicDialogProps {
  open: boolean;
  unsorted: Overview[];
  busy: boolean;
  onCreate: (input: OnCreateOptions) => void;
  onPick: (overviewId: OverviewId, picked: boolean) => void;
  onClose: () => void;
}

export const NewTopicDialog = ({ open, unsorted, busy, onCreate, onPick, onClose }: NewTopicDialogProps) => {
  const formId = useId();
  const [name, setName] = useState("");
  const [chosen, setChosen] = useState<OverviewId[]>([]);
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setName("");
      setChosen([]);
    }
  }

  const trimmed = name.trim();
  const picked = unsorted.filter((overview) => chosen.includes(overview.id));

  const toggle = (overviewId: OverviewId) => {
    onPick(overviewId, !chosen.includes(overviewId));
    setChosen((current) => (current.includes(overviewId) ? current.filter((id) => id !== overviewId) : [...current, overviewId]));
  };

  const submit = () => {
    if (trimmed === "" || busy) {
      return;
    }
    onCreate({ name: trimmed, overviews: picked });
  };

  return (
    <BottomSheet
      open={open}
      title="New topic"
      onClose={onClose}
      wide="dialog"
      width="32.5rem"
      testId={newTopicDialogTestIds.root}
      foot={
        <>
          <button type="button" className={styles.quietAction} onClick={onClose} data-testid={newTopicDialogTestIds.cancelButton}>
            Cancel
          </button>
          <button
            type="submit"
            form={formId}
            className={styles.primaryAction}
            disabled={trimmed === "" || busy}
            data-testid={newTopicDialogTestIds.createButton}
          >
            Create topic
            {picked.length > 0 && ` · ${picked.length} ${picked.length === 1 ? "overview" : "overviews"}`}
          </button>
        </>
      }
    >
      <form
        id={formId}
        className={styles.content}
        method="dialog"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className={styles.field}>
          <label className={styles.label} htmlFor="new-topic-name">
            Name
          </label>
          <input
            id="new-topic-name"
            name="topic-name"
            type="text"
            className={styles.nameInput}
            value={name}
            placeholder="e.g. climate"
            autoComplete="off"
            onChange={(event) => setName(event.target.value)}
            data-testid={newTopicDialogTestIds.nameInput}
          />
          <p className={styles.hint} data-testid={newTopicDialogTestIds.hint}>
            {trimmed === ""
              ? "Overviews that fit it are filed here from now on."
              : `Overviews that fit “${trimmed}” are filed here from now on.`}
          </p>
        </div>

        {unsorted.length > 0 && (
          <div className={styles.unsorted}>
            <p className={styles.unsortedHead} data-testid={newTopicDialogTestIds.unsortedHead}>
              Add from unsorted <span className={styles.unsortedCount}>· {unsorted.length}</span>
            </p>
            <div className={styles.unsortedList}>
              {unsorted.map((overview) => (
                <label
                  key={overview.id}
                  className={styles.option}
                  data-testid={newTopicDialogTestIds.unsortedOption(overview.source.title)}
                >
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={chosen.includes(overview.id)}
                    onChange={() => toggle(overview.id)}
                  />
                  <span className={styles.box} aria-hidden="true">
                    <StrokeIcon name="check" size={11} />
                  </span>
                  <span className={styles.optionText}>
                    {overview.source.title} <span className={styles.channel}>· {sourceName(overview.source)}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </form>
    </BottomSheet>
  );
};
