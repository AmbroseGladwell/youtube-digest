import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { DEFAULT_PLAN, type Topic, type TopicId, type TopicPatch } from "@overview/domain";
import { BottomSheet } from "../../../../components/shared/BottomSheet/BottomSheet.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useIsPhone } from "../../../../util/useIsPhone.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { useTopicsQuery } from "../../../overviews/queries/topicsQuery.js";
import type { OverviewWithState } from "../../../overviews/types/OverviewWithState.js";
import { useSettingsQuery } from "../../../settings/queries/settingsQuery.js";
import { useTopicChangeMutation } from "../../mutations/useTopicChangeMutation.js";
import {
  borrowNote,
  deleteCopy,
  deletedNotice,
  descriptionChange,
  descriptionNeedsLook,
  descriptionOrNull,
  filedUnderAny,
  leftWithoutTopic,
  mergeDefaults,
  mergeTarget,
  mergeTargetName,
  mergedNotice,
  overviewsText,
  renameCheck,
  summaryLine,
  topicUsage,
  type RenameCheck,
  type TopicUsage,
} from "../../util/manageTopics.js";
import styles from "./ManageTopicsDialog.module.scss";
import { manageTopicsDialogTestIds } from "./ManageTopicsDialogTestIds.js";

export type ManageTopicsStart = { step: "list" } | { step: "rename" | "merge" | "delete"; topicId: TopicId };

export interface UndoOffer {
  text: string;
  undo: () => void;
}

export interface ManageTopicsDialogProps {
  open: boolean;
  start: ManageTopicsStart;
  entries: OverviewWithState[];
  // A merge's Undo the dialog was showing when it closed, for the host's toast (design 10f-3).
  onClose: (undo: UndoOffer | null) => void;
}

type TopicSort = "used" | "name";

interface Notice {
  text: string;
  toast: string | null;
  undo: (() => void) | null;
}

interface Merging {
  ids: TopicId[];
  keep: TopicId | "new";
  newName: string;
  description: string;
}

const NEW_NAME = "new";
const NAME_NEEDED = "A topic needs a name.";

const sortLabel = (sort: TopicSort, isPhone: boolean): string => {
  if (sort === "name") {
    return "A–Z";
  }
  return isPhone ? "Used" : "Most used";
};

const renameStatus = (check: RenameCheck, topic: Topic): string | null => {
  switch (check.kind) {
    case "blank":
      return NAME_NEEDED;
    case "merge":
      return `${check.into.name} already exists. Saving will merge ${topic.name} into it.`;
    case "rename":
      return null;
  }
};
const DESCRIPTION_HELP = "New overviews are filed by this name and description. Say what it includes, not what it leaves out.";

export const ManageTopicsDialog = ({ open, start, entries, onClose }: ManageTopicsDialogProps) => {
  const headingId = useId();
  const isPhone = useIsPhone();
  const analytics = useAnalytics().library.manageTopics;
  const plan = useSettingsQuery().data?.plan ?? DEFAULT_PLAN;
  const topics = useTopicsQuery().data ?? [];
  const change = useTopicChangeMutation();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<TopicSort>("used");
  const [selected, setSelected] = useState<TopicId[]>([]);
  const [renaming, setRenaming] = useState<TopicId | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [merging, setMerging] = useState<Merging | null>(null);
  const [deleting, setDeleting] = useState<TopicId[] | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const keepButton = useRef<HTMLButtonElement | null>(null);

  const overviews = entries.map(({ overview }) => overview);
  const usage = topicUsage(topics, overviews);
  const usageOf = (id: TopicId): TopicUsage | undefined => usage.find(({ topic }) => topic.id === id);

  const startRename = (topic: Topic) => {
    setSelected([topic.id]);
    setRenaming(topic.id);
    setNameDraft(topic.name);
    setDescriptionDraft(topic.description ?? "");
  };

  const startMerge = (ids: TopicId[], keep?: TopicId) => {
    const picked = usage.filter(({ topic }) => ids.includes(topic.id));
    if (picked.length < 2) {
      return;
    }
    const defaults = mergeDefaults(picked, keep);
    setRenaming(null);
    setMerging({ ids: picked.map(({ topic }) => topic.id), keep: defaults.keep, newName: "", description: defaults.description });
  };

  const askDelete = (ids: TopicId[]) => {
    setRenaming(null);
    setDeleting(ids);
  };

  const asked = deleting === null ? null : deleting.join();
  useEffect(() => {
    if (asked !== null) {
      const ids = asked.split(",") as TopicId[];
      analytics.deleteAsked({ topics: ids.length, overviews: filedUnderAny(overviews, ids), plan });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asked]);

  const [wasOpen, setWasOpen] = useState(false);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setSort("used");
      setSelected([]);
      setRenaming(null);
      setMerging(null);
      setDeleting(null);
      setNotice(null);
      const topic = start.step === "list" ? undefined : topics.find(({ id }) => id === start.topicId);
      if (topic !== undefined && start.step === "rename") {
        startRename(topic);
      } else if (topic !== undefined && start.step === "merge") {
        setSelected([topic.id]);
      } else if (topic !== undefined && start.step === "delete") {
        setSelected([topic.id]);
        askDelete([topic.id]);
      }
    }
  }

  const ordered = sort === "used" ? usage : [...usage].sort((left, right) => left.topic.name.localeCompare(right.topic.name));
  const needle = query.trim().toLocaleLowerCase();
  const shown = ordered.filter(({ topic }) => topic.name.toLocaleLowerCase().includes(needle));
  const one = usage.length === 1;

  const close = () => {
    analytics.closed({ plan });
    onClose(notice?.undo != null && notice.toast !== null ? { text: notice.toast, undo: notice.undo } : null);
  };

  const backToList = () => {
    setMerging(null);
    setDeleting(null);
  };

  const keepTopics = () => {
    if (deleting !== null) {
      analytics.deleteKept({ topics: deleting.length, plan });
    }
    backToList();
  };

  const stepBack = () => {
    if (renaming !== null) {
      setRenaming(null);
      setSelected([]);
    } else if (deleting !== null) {
      keepTopics();
    } else if (merging !== null) {
      backToList();
    } else {
      close();
    }
  };

  const toggle = (id: TopicId) =>
    setSelected((current) => (current.includes(id) ? current.filter((each) => each !== id) : [...current, id]));

  const saveRename = (topic: Topic) => {
    const check = renameCheck(nameDraft, topic, topics);
    if (check.kind === "blank") {
      return;
    }
    if (check.kind === "merge") {
      startMerge([check.into.id, topic.id], check.into.id);
      return;
    }
    const description = descriptionOrNull(descriptionDraft);
    const patch: TopicPatch = {
      ...(check.name === topic.name ? {} : { name: check.name }),
      ...(description === topic.description ? {} : { description }),
    };
    setRenaming(null);
    setSelected([]);
    if (Object.keys(patch).length > 0) {
      change.mutate({ kind: "edit", id: topic.id, patch });
      analytics.renamed({ nameChanged: patch.name !== undefined, description: descriptionChange(topic, description), plan });
    }
  };

  const merge = (state: Merging) => {
    const picked = state.ids.flatMap((id) => topics.find((topic) => topic.id === id) ?? []);
    const target = mergeTarget(state.keep, state.newName, picked, topics);
    if (target === null) {
      return;
    }
    const kept = target.kind === "new" ? picked[0]! : target.topic;
    const from = picked.filter(({ id }) => id !== kept.id).map(({ id }) => id);
    const description = descriptionOrNull(state.description);
    const patch: TopicPatch = {
      ...(target.kind === "new" ? { name: target.name } : {}),
      ...(description === kept.description ? {} : { description }),
    };
    const restore: TopicPatch = {
      ...(patch.name === undefined ? {} : { name: kept.name }),
      ...(patch.description === undefined ? {} : { description: kept.description }),
    };
    const name = target.kind === "new" ? target.name : kept.name;
    const together = new Set([...from, kept.id]).size;
    const filed = filedUnderAny(overviews, [...from, kept.id]);
    setMerging(null);
    setSelected([]);
    analytics.merged({
      topics: together,
      overviews: filed,
      newName: target.kind === "new",
      descriptionEdited: patch.description !== undefined,
      plan,
    });
    change.mutate(
      { kind: "merge", from, into: kept.id, patch: Object.keys(patch).length > 0 ? patch : null },
      {
        onSuccess: (merges) => {
          const undo = () => {
            change.mutate({ kind: "undoMerge", merges, into: kept.id, restore: Object.keys(restore).length > 0 ? restore : null });
            setNotice(null);
          };
          setNotice({ text: mergedNotice(together, name, filed), toast: `Merged ${together} topics into ${name}`, undo });
        },
      },
    );
  };

  const confirmDelete = (ids: TopicId[]) => {
    const gone = ids.flatMap((id) => topics.find((topic) => topic.id === id) ?? []);
    const unsorted = leftWithoutTopic(overviews, ids);
    analytics.deleted({ topics: ids.length, overviews: filedUnderAny(overviews, ids), unsorted, plan });
    change.mutate({ kind: "delete", ids });
    setNotice({ text: deletedNotice(gone, unsorted), toast: null, undo: null });
    setDeleting(null);
    setSelected([]);
  };

  const back = (onBack: () => void) => (
    <button type="button" className={styles.back} onClick={onBack} data-testid={manageTopicsDialogTestIds.backButton}>
      <StrokeIcon name="chevronLeft" size={14} />
      Topics
    </button>
  );

  const head = () => {
    if (deleting !== null) {
      const gone = deleting.flatMap((id) => topics.find((topic) => topic.id === id) ?? []);
      return (
        <div className={styles.headText}>
          {back(keepTopics)}
          <h2 className={styles.confirmHeading} id={headingId}>
            {deleteCopy(gone, 0, 0).title}
          </h2>
        </div>
      );
    }
    if (merging !== null) {
      return (
        <div className={styles.headText}>
          {back(backToList)}
          <h2 className={styles.heading} id={headingId}>
            Merge {merging.ids.length} topics
          </h2>
          <p className={styles.subhead}>Every overview in them is filed under the one you keep, once. The others go.</p>
        </div>
      );
    }
    return (
      <div className={styles.headText}>
        <h2 className={styles.heading} id={headingId}>
          Manage topics
        </h2>
        {!isPhone && (
          <p className={styles.subhead} data-testid={manageTopicsDialogTestIds.summary}>
            {summaryLine(usage.length, entries.length)}
          </p>
        )}
      </div>
    );
  };

  const content = () => {
    if (deleting !== null) {
      const gone = deleting.flatMap((id) => topics.find((topic) => topic.id === id) ?? []);
      return (
        <DeleteStep
          keepButton={keepButton}
          headingId={headingId}
          copy={deleteCopy(gone, filedUnderAny(overviews, deleting), leftWithoutTopic(overviews, deleting))}
          onBack={keepTopics}
          onConfirm={() => confirmDelete(deleting)}
        />
      );
    }
    if (merging !== null) {
      return (
        <MergeStep
          state={merging}
          picked={merging.ids.flatMap((id) => usageOf(id) ?? [])}
          topics={topics}
          countFiled={(ids) => filedUnderAny(overviews, ids)}
          onChange={setMerging}
          onBack={backToList}
          onMerge={() => merge(merging)}
        />
      );
    }
    return (
      <>
        {notice !== null && (
          <div className={styles.notice} role="status" data-testid={manageTopicsDialogTestIds.notice}>
            <StrokeIcon name="check" size={13} />
            <span className={styles.noticeText}>{notice.text}</span>
            {notice.undo !== null && (
              <button
                type="button"
                className={styles.undo}
                onClick={() => {
                  notice.undo?.();
                  analytics.undone({ from: "notice", plan });
                }}
                data-testid={manageTopicsDialogTestIds.undoButton}
              >
                <StrokeIcon name="undo2" size={14} />
                Undo
              </button>
            )}
          </div>
        )}

        <div className={styles.tools}>
          <label className={styles.search}>
            <span className={styles.searchIcon} aria-hidden="true">
              <StrokeIcon name="search" size={15} />
            </span>
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Find a topic"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Find a topic"
              data-testid={manageTopicsDialogTestIds.searchInput}
            />
          </label>
          <div className={styles.sort} role="radiogroup" aria-label="Sort">
            {(["used", "name"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={sort === option}
                className={`${styles.sortOption} ${sort === option ? styles.sortOptionOn : ""}`}
                onClick={() => setSort(option)}
                data-testid={manageTopicsDialogTestIds.sortOption(option)}
              >
                {sortLabel(option, isPhone)}
              </button>
            ))}
          </div>
        </div>

        <ul className={styles.list} aria-label="Topics" data-testid={manageTopicsDialogTestIds.list}>
          {shown.map(({ topic, count }) =>
            renaming === topic.id ? (
              <RenameRow
                key={topic.id}
                topic={topic}
                check={renameCheck(nameDraft, topic, topics)}
                name={nameDraft}
                description={descriptionDraft}
                onName={setNameDraft}
                onDescription={setDescriptionDraft}
                onCancel={() => {
                  setRenaming(null);
                  setSelected([]);
                }}
                onSave={() => saveRename(topic)}
              />
            ) : (
              <li key={topic.id}>
                <label
                  className={`${styles.row} ${selected.includes(topic.id) ? styles.rowSelected : ""}`}
                  data-testid={manageTopicsDialogTestIds.row(topic.name)}
                >
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={selected.includes(topic.id)}
                    onChange={() => toggle(topic.id)}
                  />
                  <span className={styles.box} aria-hidden="true">
                    <StrokeIcon name="check" size={13} />
                  </span>
                  <span className={styles.topicText}>
                    <span className={styles.topicName}>{topic.name}</span>
                    {topic.description !== null && <span className={styles.description}>{topic.description}</span>}
                  </span>
                  <span className={styles.count}>{overviewsText(count)}</span>
                </label>
              </li>
            ),
          )}
        </ul>
        {shown.length === 0 && (
          <p className={styles.empty} data-testid={manageTopicsDialogTestIds.empty}>
            {usage.length === 0 ? "There are no topics yet." : `No topics match “${query.trim()}”.`}
          </p>
        )}

        <div className={styles.bar}>
          {selected.length === 0 ? (
            <p className={styles.barHint} data-testid={manageTopicsDialogTestIds.barHint}>
              {one ? "Select the topic to rename or delete it." : "Select topics to rename, merge or delete them."}
            </p>
          ) : (
            <>
              <span className={styles.selectedCount} aria-live="polite">
                {selected.length} selected
              </span>
              <span className={styles.barActions}>
                {selected.length === 1 ? (
                  <button
                    type="button"
                    className={styles.secondary}
                    onClick={() => {
                      const topic = topics.find(({ id }) => id === selected[0]);
                      if (topic !== undefined) {
                        startRename(topic);
                      }
                    }}
                    data-testid={manageTopicsDialogTestIds.renameButton}
                  >
                    <StrokeIcon name="pen" size={14} />
                    Rename
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.primary}
                    onClick={() => startMerge(selected)}
                    data-testid={manageTopicsDialogTestIds.mergeButton}
                  >
                    <StrokeIcon name="merge" size={14} />
                    Merge…
                  </button>
                )}
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => askDelete(selected)}
                  data-testid={manageTopicsDialogTestIds.deleteButton}
                >
                  <StrokeIcon name="trash" size={14} />
                  Delete
                </button>
                <button
                  type="button"
                  className={styles.quiet}
                  onClick={() => setSelected([])}
                  data-testid={manageTopicsDialogTestIds.clearButton}
                >
                  Clear
                </button>
              </span>
            </>
          )}
        </div>
      </>
    );
  };

  return (
    <BottomSheet
      open={open}
      title="Manage topics"
      onClose={close}
      onEscape={stepBack}
      wide="dialog"
      width="35rem"
      head={head()}
      labelledBy={headingId}
      {...(deleting === null ? {} : { initialFocus: keepButton })}
      testId={manageTopicsDialogTestIds.root}
    >
      <div className={`${styles.content} ${deleting === null ? "" : styles.contentFits}`}>{content()}</div>
    </BottomSheet>
  );
};

interface DescriptionFieldProps {
  label: string;
  value: string;
  look: string | null;
  onChange: (value: string) => void;
}

const DescriptionField = ({ label, value, look, onChange }: DescriptionFieldProps) => {
  const id = useId();
  const field = useRef<HTMLTextAreaElement | null>(null);
  return (
    <>
      <label className={styles.fieldLabel} htmlFor={id}>
        {label} <span className={styles.optional}>· optional</span>
      </label>
      <div className={`${styles.area} ${look !== null ? styles.areaLook : ""}`}>
        <textarea
          id={id}
          ref={field}
          className={styles.areaInput}
          value={value}
          rows={2}
          placeholder="None: filed by the name alone"
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={`${id}-help`}
          data-testid={manageTopicsDialogTestIds.descriptionInput}
        />
        {value !== "" && (
          <button
            type="button"
            className={styles.clearDescription}
            onClick={() => {
              onChange("");
              field.current?.focus();
            }}
            data-testid={manageTopicsDialogTestIds.clearDescriptionButton}
          >
            Clear
          </button>
        )}
      </div>
      {look !== null && (
        <p className={styles.look} role="status" data-testid={manageTopicsDialogTestIds.descriptionLook}>
          <StrokeIcon name="alertCircle" size={14} />
          <span>{look}</span>
        </p>
      )}
      <p className={styles.help} id={`${id}-help`}>
        {DESCRIPTION_HELP}
      </p>
    </>
  );
};

interface RenameRowProps {
  topic: Topic;
  check: RenameCheck;
  name: string;
  description: string;
  onName: (name: string) => void;
  onDescription: (description: string) => void;
  onCancel: () => void;
  onSave: () => void;
}

const RenameRow = ({ topic, check, name, description, onName, onDescription, onCancel, onSave }: RenameRowProps) => {
  const nameId = useId();
  const statusId = useId();
  const row = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    row.current?.scrollIntoView({ block: "nearest" });
  }, []);
  const blank = check.kind === "blank";
  const merges = check.kind === "merge";
  const status = renameStatus(check, topic);
  const look =
    !merges && descriptionNeedsLook(topic, name, description) ? `You changed the name. Does this still describe ${name.trim()}?` : null;

  return (
    <li ref={row} className={styles.renameRow} data-testid={manageTopicsDialogTestIds.renameRow}>
      <form
        className={styles.renameForm}
        role="group"
        aria-label={`Edit ${topic.name}`}
        onSubmit={(event) => {
          event.preventDefault();
          if (!blank) {
            onSave();
          }
        }}
      >
        <label className={styles.fieldLabel} htmlFor={nameId}>
          Name
        </label>
        <input
          id={nameId}
          type="text"
          className={`${styles.nameInput} ${blank ? styles.nameInputBad : ""}`}
          value={name}
          onChange={(event) => onName(event.target.value)}
          aria-invalid={blank}
          aria-describedby={status === null ? undefined : statusId}
          autoComplete="off"
          autoFocus
          data-testid={manageTopicsDialogTestIds.nameInput}
        />
        {!merges && <DescriptionField label="Description" value={description} look={look} onChange={onDescription} />}
        {status !== null && (
          <p
            id={statusId}
            className={`${styles.renameStatus} ${blank ? styles.renameStatusBad : ""}`}
            role={blank ? "alert" : "status"}
            data-testid={manageTopicsDialogTestIds.renameStatus}
          >
            {status}
          </p>
        )}
        <div className={styles.renameActions}>
          <button type="button" className={styles.quiet} onClick={onCancel} data-testid={manageTopicsDialogTestIds.cancelRenameButton}>
            Cancel
          </button>
          <button
            type="submit"
            className={blank ? styles.secondary : styles.primary}
            aria-disabled={blank}
            data-testid={manageTopicsDialogTestIds.saveRenameButton}
          >
            {merges ? "Merge…" : "Save"}
          </button>
        </div>
      </form>
    </li>
  );
};

interface MergeStepProps {
  state: Merging;
  picked: TopicUsage[];
  topics: Topic[];
  countFiled: (ids: TopicId[]) => number;
  onChange: (state: Merging) => void;
  onBack: () => void;
  onMerge: () => void;
}

const MergeStep = ({ state, picked, topics, countFiled, onChange, onBack, onMerge }: MergeStepProps) => {
  const target = mergeTarget(
    state.keep,
    state.newName,
    picked.map(({ topic }) => topic),
    topics,
  );
  const name = mergeTargetName(target);
  const together = target !== null && target.kind === "existing" ? [...state.ids, target.topic.id] : state.ids;
  const note = borrowNote(mergeDefaults(picked, state.keep === NEW_NAME ? picked[0]!.topic.id : state.keep));

  return (
    <form
      className={styles.step}
      onSubmit={(event) => {
        event.preventDefault();
        if (target !== null) {
          onMerge();
        }
      }}
    >
      <div className={styles.stepBody}>
        <fieldset className={styles.choices}>
          <legend className={styles.legend}>Name to keep</legend>
          {picked.map(({ topic, count }) => (
            <label
              key={topic.id}
              className={`${styles.choice} ${state.keep === topic.id ? styles.choiceOn : ""}`}
              data-testid={manageTopicsDialogTestIds.keepOption(topic.name)}
            >
              <input
                type="radio"
                name="keep"
                className={styles.radio}
                checked={state.keep === topic.id}
                onChange={() => {
                  const defaults = mergeDefaults(picked, topic.id);
                  onChange({ ...state, keep: topic.id, description: defaults.description });
                }}
              />
              <span className={styles.dot} aria-hidden="true" />
              <span className={styles.topicName}>{topic.name}</span>
              <span className={styles.count}>{overviewsText(count)}</span>
            </label>
          ))}
          <label
            className={`${styles.choice} ${state.keep === NEW_NAME ? styles.choiceOn : ""}`}
            data-testid={manageTopicsDialogTestIds.keepOption(NEW_NAME)}
          >
            <input
              type="radio"
              name="keep"
              className={styles.radio}
              checked={state.keep === NEW_NAME}
              onChange={() => onChange({ ...state, keep: NEW_NAME })}
            />
            <span className={styles.dot} aria-hidden="true" />
            {state.keep === NEW_NAME ? (
              <input
                type="text"
                className={styles.newNameInput}
                value={state.newName}
                onChange={(event) => onChange({ ...state, newName: event.target.value })}
                placeholder="A new name…"
                aria-label="A new name"
                autoComplete="off"
                autoFocus
                data-testid={manageTopicsDialogTestIds.newNameInput}
              />
            ) : (
              <span className={styles.newNameLabel}>A new name…</span>
            )}
          </label>
        </fieldset>

        <div className={styles.keptDescription}>
          <DescriptionField
            label="Description it keeps"
            value={state.description}
            look={null}
            onChange={(description) => onChange({ ...state, description })}
          />
          {note !== null && (
            <p className={styles.borrow} data-testid={manageTopicsDialogTestIds.borrowNote}>
              {note}
            </p>
          )}
        </div>
      </div>

      <div className={styles.stepFoot}>
        <p className={styles.subhead} role="status" data-testid={manageTopicsDialogTestIds.mergeSummary}>
          {name === null
            ? NAME_NEEDED
            : `${overviewsText(countFiled(together))} will be in ${name}. Undo puts everything back, the description too.`}
        </p>
        <div className={styles.stepActions}>
          <button
            type="submit"
            className={styles.primaryLarge}
            aria-disabled={name === null}
            data-testid={manageTopicsDialogTestIds.confirmMergeButton}
          >
            <StrokeIcon name="merge" size={14} />
            {name === null ? "Merge" : `Merge into ${name}`}
          </button>
          <button type="button" className={styles.secondaryLarge} onClick={onBack}>
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
};

interface DeleteStepProps {
  keepButton: RefObject<HTMLButtonElement | null>;
  headingId: string;
  copy: ReturnType<typeof deleteCopy>;
  onBack: () => void;
  onConfirm: () => void;
}

const DeleteStep = ({ keepButton, headingId, copy, onBack, onConfirm }: DeleteStepProps) => {
  const bodyId = useId();
  useEffect(() => {
    keepButton.current?.focus();
  }, [keepButton]);
  return (
    <div
      className={styles.confirm}
      role="alertdialog"
      aria-labelledby={headingId}
      aria-describedby={bodyId}
      data-testid={manageTopicsDialogTestIds.deleteStep}
    >
      {copy.names !== null && <p className={styles.confirmNames}>{copy.names}</p>}
      <p className={styles.confirmBody} id={bodyId}>
        {copy.body}
      </p>
      <div className={styles.stepActions}>
        <button
          type="button"
          className={styles.dangerLarge}
          onClick={onConfirm}
          data-testid={manageTopicsDialogTestIds.confirmDeleteButton}
        >
          <StrokeIcon name="trash" size={14} />
          {copy.button}
        </button>
        <button
          type="button"
          ref={keepButton}
          className={styles.secondaryLarge}
          onClick={onBack}
          data-testid={manageTopicsDialogTestIds.keepButton}
        >
          Keep
        </button>
      </div>
    </div>
  );
};
