import { useEffect, useRef, useState } from "react";
import { OverviewId, type Overview } from "@overview/domain";
import styles from "./NewTopicDialog.module.scss";
import { newTopicDialogTestIds } from "./NewTopicDialogTestIds.js";

export interface NewTopicDialogProps {
  open: boolean;
  unsorted: Overview[];
  busy: boolean;
  onCreate: (input: { name: string; overviews: Overview[] }) => void;
  onClose: () => void;
}

const HEADING_ID = "NewTopicDialog-heading";

export function NewTopicDialog({ open, unsorted, busy, onCreate, onClose }: NewTopicDialogProps) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  const [name, setName] = useState("");
  const [chosen, setChosen] = useState<OverviewId[]>([]);

  useEffect(() => {
    const element = dialog.current;
    if (!element) {
      return;
    }
    if (open && !element.open) {
      setName("");
      setChosen([]);
      element.showModal();
    }
    if (!open && element.open) {
      element.close();
    }
  }, [open]);

  const trimmed = name.trim();
  const picked = unsorted.filter((overview) => chosen.includes(overview.id));

  const toggle = (overviewId: OverviewId) =>
    setChosen((current) =>
      current.includes(overviewId)
        ? current.filter((id) => id !== overviewId)
        : [...current, overviewId],
    );

  const submit = () => {
    if (trimmed === "" || busy) {
      return;
    }
    onCreate({ name: trimmed, overviews: picked });
  };

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={HEADING_ID}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) {
          onClose();
        }
      }}
      data-testid={newTopicDialogTestIds.root}
    >
      <form
        className={styles.panel}
        method="dialog"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <span className={styles.handle} aria-hidden="true" />

        <div className={styles.head}>
          <h2 className={styles.heading} id={HEADING_ID}>
            New topic
          </h2>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Close"
            data-testid={newTopicDialogTestIds.closeButton}
          >
            ✕
          </button>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="new-topic-name">
            Name
          </label>
          <input
            id="new-topic-name"
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
                  data-testid={newTopicDialogTestIds.unsortedOption(overview.video.title)}
                >
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={chosen.includes(overview.id)}
                    onChange={() => toggle(overview.id)}
                  />
                  <span className={styles.box} aria-hidden="true">
                    ✓
                  </span>
                  <span className={styles.optionText}>
                    {overview.video.title} <span className={styles.channel}>· {overview.video.channel}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className={styles.foot}>
          <button
            type="button"
            className={styles.quietAction}
            onClick={onClose}
            data-testid={newTopicDialogTestIds.cancelButton}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={styles.primaryAction}
            disabled={trimmed === "" || busy}
            data-testid={newTopicDialogTestIds.createButton}
          >
            Create topic
            {picked.length > 0 && ` · ${picked.length} ${picked.length === 1 ? "overview" : "overviews"}`}
          </button>
        </div>
      </form>
    </dialog>
  );
}
