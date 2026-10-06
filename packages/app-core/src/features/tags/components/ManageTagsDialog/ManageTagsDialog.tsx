import { useEffect, useId, useRef, useState } from "react";
import { normaliseTag, tagUsage, type TagCount } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import type { OverviewWithState } from "../../../overviews/types/OverviewWithState.js";
import { overviewTags } from "../../../overviews/util/overviewTags.js";
import { useSettingsQuery } from "../../../settings/queries/settingsQuery.js";
import { useEditTagsMutation } from "../../mutations/useEditTagsMutation.js";
import { planTagEdit, type TagEdit, type TagEditPlan } from "../../util/planTagEdit.js";
import styles from "./ManageTagsDialog.module.scss";
import { manageTagsDialogTestIds } from "./ManageTagsDialogTestIds.js";

export interface ManageTagsDialogProps {
  open: boolean;
  entries: OverviewWithState[];
  onClose: () => void;
}

type TagSort = "used" | "name";

interface Notice {
  text: string;
  undo: TagEditPlan;
}

const NEW_NAME = "new";
const REFUSED = "Use at least one letter or number.";

const overviewsText = (count: number) => `${count} ${count === 1 ? "overview" : "overviews"}`;

const carrying = (entries: OverviewWithState[], tags: readonly string[]) =>
  entries.filter((entry) => overviewTags(entry).some((tag) => tags.includes(tag))).length;

// Design 84j–84n: pick tags, then merge, rename or delete them. Every change lands at once and
// offers Undo until the dialog closes, rather than asking first (docs/features/tag-reuse.md).
export function ManageTagsDialog({ open, entries, onClose }: ManageTagsDialogProps) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  const headingId = useId();
  const analytics = useAnalytics().library.manageTags;
  const settings = useSettingsQuery();
  const editTags = useEditTagsMutation();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<TagSort>("used");
  const [selected, setSelected] = useState<string[]>([]);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [merging, setMerging] = useState(false);
  const [keep, setKeep] = useState<string>(NEW_NAME);
  const [newName, setNewName] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      setQuery("");
      setSort("used");
      setSelected([]);
      setRenaming(null);
      setMerging(false);
      setNotice(null);
      element.showModal();
    }
    if (!open && element.open) element.close();
  }, [open]);

  const usage = open ? tagUsage(entries.map(overviewTags)) : [];
  const countOf = (tag: string) => usage.find((entry) => entry.tag === tag)?.count ?? 0;
  const ordered = sort === "used" ? usage : [...usage].sort((left, right) => left.tag.localeCompare(right.tag));
  const needle = query.trim().toLowerCase().replace(/^#/, "").replace(/\s+/g, "-");
  const shown = ordered.filter(({ tag }) => tag.includes(needle));

  const edit = (change: TagEdit, describe: (overviewsChanged: number) => string) => {
    const planned = planTagEdit(entries, settings.data?.tagAliases ?? {}, change);
    editTags.mutate(planned.apply);
    setNotice({ text: describe(planned.overviewsChanged), undo: planned.undo });
    setSelected([]);
    setRenaming(null);
    setMerging(false);
    return planned.overviewsChanged;
  };

  const close = () => {
    analytics.closed();
    onClose();
  };

  const startRename = (tag: string) => {
    setSelected([]);
    setRenaming(tag);
    setRenameDraft(tag);
  };

  const startMerge = () => {
    setKeep(selectedByUse()[0]?.tag ?? NEW_NAME);
    setNewName("");
    setMerging(true);
  };

  const selectedByUse = (): TagCount[] => usage.filter(({ tag }) => selected.includes(tag));

  const deleteSelected = () => {
    const tags = selected;
    const changed = edit({ from: tags, to: null }, (count) =>
      tags.length === 1
        ? `Deleted #${tags[0]} from ${overviewsText(count)}.`
        : `Deleted ${tags.length} tags from ${overviewsText(count)}.`,
    );
    analytics.deleted({ tags: tags.length, overviews: changed });
  };

  const toggle = (tag: string) =>
    setSelected((current) => (current.includes(tag) ? current.filter((each) => each !== tag) : [...current, tag]));

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={headingId}
      onCancel={(event) => {
        event.preventDefault();
        if (renaming !== null) setRenaming(null);
        else if (merging) setMerging(false);
        else close();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) close();
      }}
      data-testid={manageTagsDialogTestIds.root}
    >
      {open && (
        <div className={styles.panel}>
          <span className={styles.handle} aria-hidden="true" />
          {merging ? (
            <MergeStep
              headingId={headingId}
              tags={selectedByUse()}
              keep={keep}
              newName={newName}
              existing={usage}
              countTagged={(tags) => carrying(entries, tags)}
              onKeep={setKeep}
              onNewName={setNewName}
              onBack={() => setMerging(false)}
              onClose={close}
              onMerge={(target) => {
                const from = selected;
                const tagged = carrying(entries, [...from, target]);
                const changed = edit(
                  { from, to: target },
                  () => `Merged ${from.length} tags into #${target}, now on ${overviewsText(tagged)}.`,
                );
                analytics.merged({ tags: from.length, overviews: changed });
              }}
            />
          ) : (
            <>
              <div className={styles.head}>
                <div className={styles.headText}>
                  <h2 className={styles.heading} id={headingId}>
                    Manage tags
                  </h2>
                  <p className={styles.subhead} data-testid={manageTagsDialogTestIds.summary}>
                    {usage.length} {usage.length === 1 ? "tag" : "tags"} on {overviewsText(entries.length)}.
                    Changes apply to every overview that uses the tag.
                  </p>
                </div>
                <CloseButton onClose={close} />
              </div>

              {notice !== null && (
                <div className={styles.notice} role="status" data-testid={manageTagsDialogTestIds.notice}>
                  <StrokeIcon name="check" />
                  <span className={styles.noticeText}>{notice.text}</span>
                  <button
                    type="button"
                    className={styles.undo}
                    onClick={() => {
                      editTags.mutate(notice.undo);
                      analytics.undone();
                      setNotice(null);
                    }}
                    data-testid={manageTagsDialogTestIds.undoButton}
                  >
                    <StrokeIcon name="rotateCcw" />
                    Undo
                  </button>
                </div>
              )}

              <div className={styles.tools}>
                <label className={styles.search}>
                  <span className={styles.searchIcon} aria-hidden="true">
                    <StrokeIcon name="search" size={16} />
                  </span>
                  <input
                    type="search"
                    className={styles.searchInput}
                    placeholder="Find a tag"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    aria-label="Find a tag"
                    data-testid={manageTagsDialogTestIds.searchInput}
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
                      data-testid={manageTagsDialogTestIds.sortOption(option)}
                    >
                      {option === "used" ? "Most used" : "A–Z"}
                    </button>
                  ))}
                </div>
              </div>

              <ul className={styles.list} aria-label="Tags" data-testid={manageTagsDialogTestIds.list}>
                {shown.map(({ tag, count }) =>
                  renaming === tag ? (
                    <RenameRow
                      key={tag}
                      tag={tag}
                      draft={renameDraft}
                      count={count}
                      exists={(target) => target !== tag && countOf(target) > 0}
                      onDraft={setRenameDraft}
                      onCancel={() => setRenaming(null)}
                      onSave={(target) => {
                        const intoExisting = countOf(target) > 0;
                        const changed = edit({ from: [tag], to: target }, (changedCount) =>
                          intoExisting
                            ? `Merged #${tag} into #${target}, now on ${overviewsText(
                                carrying(entries, [tag, target]),
                              )}.`
                            : `Renamed #${tag} to #${target} on ${overviewsText(changedCount)}.`,
                        );
                        analytics.renamed({ intoExisting, overviews: changed });
                      }}
                    />
                  ) : (
                    <li key={tag}>
                      <label
                        className={`${styles.row} ${selected.includes(tag) ? styles.rowSelected : ""}`}
                        data-testid={manageTagsDialogTestIds.row(tag)}
                      >
                        <input
                          type="checkbox"
                          className={styles.checkbox}
                          checked={selected.includes(tag)}
                          onChange={() => toggle(tag)}
                        />
                        <span className={styles.box} aria-hidden="true">
                          <StrokeIcon name="check" size={11} />
                        </span>
                        <span className={styles.tagName}>#{tag}</span>
                        <span className={styles.count}>{overviewsText(count)}</span>
                      </label>
                    </li>
                  ),
                )}
              </ul>
              {shown.length === 0 && (
                <p className={styles.empty} data-testid={manageTagsDialogTestIds.empty}>
                  {usage.length === 0 ? "No overview has a tag yet." : `No tags match “${query.trim()}”.`}
                </p>
              )}

              <div className={styles.bar}>
                {selected.length === 0 ? (
                  <p className={styles.barHint}>Select tags to merge, rename or delete them.</p>
                ) : (
                  <>
                    <span className={styles.selectedCount} aria-live="polite">
                      {selected.length} selected
                    </span>
                    <span className={styles.barActions}>
                      {selected.length === 1 ? (
                        <button
                          type="button"
                          className={styles.primary}
                          onClick={() => startRename(selected[0]!)}
                          data-testid={manageTagsDialogTestIds.renameButton}
                        >
                          <StrokeIcon name="pencil" />
                          Rename
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={styles.primary}
                          onClick={startMerge}
                          data-testid={manageTagsDialogTestIds.mergeButton}
                        >
                          Merge…
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.secondary}
                        onClick={deleteSelected}
                        data-testid={manageTagsDialogTestIds.deleteButton}
                      >
                        <StrokeIcon name="trash" />
                        Delete
                      </button>
                      <button
                        type="button"
                        className={styles.quiet}
                        onClick={() => setSelected([])}
                        data-testid={manageTagsDialogTestIds.clearButton}
                      >
                        Clear
                      </button>
                    </span>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </dialog>
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      className={styles.close}
      onClick={onClose}
      aria-label="Close"
      data-testid={manageTagsDialogTestIds.closeButton}
    >
      <StrokeIcon name="close" size={16} />
    </button>
  );
}

// 84l: the row becomes a field that says what it will save as, refuses a name with nothing
// in it, and turns into a merge when the name is taken.
function RenameRow({
  tag,
  draft,
  count,
  exists,
  onDraft,
  onCancel,
  onSave,
}: {
  tag: string;
  draft: string;
  count: number;
  exists: (target: string) => boolean;
  onDraft: (draft: string) => void;
  onCancel: () => void;
  onSave: (target: string) => void;
}) {
  const statusId = useId();
  const row = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    row.current?.scrollIntoView({ block: "nearest" });
  }, []);
  const target = normaliseTag(draft);
  const merges = target !== null && exists(target);
  const status =
    target === null
      ? REFUSED
      : merges
        ? `#${target} already exists. Saving merges #${tag} into it: ` +
          `${overviewsText(count)} ${count === 1 ? "moves" : "move"} to #${target}.`
        : `Saves as #${target}`;
  const canSave = target !== null && target !== tag;

  return (
    <li ref={row} className={styles.renameRow} data-testid={manageTagsDialogTestIds.renameRow}>
      <form
        className={styles.renameForm}
        onSubmit={(event) => {
          event.preventDefault();
          if (canSave) onSave(target);
        }}
      >
        <input
          type="text"
          className={styles.renameInput}
          value={draft}
          onChange={(event) => onDraft(event.target.value)}
          aria-label={`New name for #${tag}`}
          aria-describedby={statusId}
          aria-invalid={target === null}
          autoComplete="off"
          autoFocus
          data-testid={manageTagsDialogTestIds.renameInput}
        />
        <button
          type="submit"
          className={styles.primary}
          disabled={!canSave}
          data-testid={manageTagsDialogTestIds.saveRenameButton}
        >
          {merges ? "Merge" : "Save"}
        </button>
        <button type="button" className={styles.quiet} onClick={onCancel}>
          Cancel
        </button>
      </form>
      <p id={statusId} className={styles.renameStatus} role="status" data-testid={manageTagsDialogTestIds.renameStatus}>
        {status}
      </p>
    </li>
  );
}

// 84k: which name the merged tags keep, most used first and chosen already, or a new one.
function MergeStep({
  headingId,
  tags,
  keep,
  newName,
  existing,
  countTagged,
  onKeep,
  onNewName,
  onBack,
  onClose,
  onMerge,
}: {
  headingId: string;
  tags: TagCount[];
  keep: string;
  newName: string;
  existing: TagCount[];
  countTagged: (tags: string[]) => number;
  onKeep: (keep: string) => void;
  onNewName: (name: string) => void;
  onBack: () => void;
  onClose: () => void;
  onMerge: (target: string) => void;
}) {
  const target = keep === NEW_NAME ? normaliseTag(newName) : keep;
  const others = tags.length - 1;
  const tagged = target === null ? 0 : countTagged([...tags.map(({ tag }) => tag), target]);
  const joinsExisting = keep === NEW_NAME && target !== null && existing.some(({ tag }) => tag === target);

  return (
    <form
      className={styles.step}
      onSubmit={(event) => {
        event.preventDefault();
        if (target !== null) onMerge(target);
      }}
    >
      <div className={styles.head}>
        <div className={styles.headText}>
          <button
            type="button"
            className={styles.back}
            onClick={onBack}
            data-testid={manageTagsDialogTestIds.backButton}
          >
            <StrokeIcon name="arrowLeft" />
            Tags
          </button>
          <h2 className={styles.heading} id={headingId}>
            Merge {tags.length} tags
          </h2>
          <p className={styles.subhead}>
            {others === 1 ? "The other name becomes an alias" : `The other ${others} names become aliases`} of the
            one you keep, so new overviews use it too.
          </p>
        </div>
        <CloseButton onClose={onClose} />
      </div>

      <fieldset className={styles.choices}>
        <legend className={styles.legend}>Name to keep</legend>
        {tags.map(({ tag, count }) => (
          <label
            key={tag}
            className={`${styles.choice} ${keep === tag ? styles.choiceOn : ""}`}
            data-testid={manageTagsDialogTestIds.keepOption(tag)}
          >
            <input
              type="radio"
              name="keep"
              className={styles.radio}
              checked={keep === tag}
              onChange={() => onKeep(tag)}
            />
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.tagName}>#{tag}</span>
            <span className={styles.count}>{overviewsText(count)}</span>
          </label>
        ))}
        <label
          className={`${styles.choice} ${keep === NEW_NAME ? styles.choiceOn : ""}`}
          data-testid={manageTagsDialogTestIds.keepOption(NEW_NAME)}
        >
          <input
            type="radio"
            name="keep"
            className={styles.radio}
            checked={keep === NEW_NAME}
            onChange={() => onKeep(NEW_NAME)}
          />
          <span className={styles.dot} aria-hidden="true" />
          {keep === NEW_NAME ? (
            <input
              type="text"
              className={styles.newNameInput}
              value={newName}
              onChange={(event) => onNewName(event.target.value)}
              placeholder="A new name…"
              aria-label="A new name"
              autoComplete="off"
              autoFocus
              data-testid={manageTagsDialogTestIds.newNameInput}
            />
          ) : (
            <span className={styles.newNameLabel}>A new name…</span>
          )}
        </label>
      </fieldset>

      <div className={styles.stepFoot}>
        <p className={styles.subhead} role="status" data-testid={manageTagsDialogTestIds.mergeSummary}>
          {target === null
            ? REFUSED
            : `${overviewsText(tagged)} will be tagged #${target}${joinsExisting ? ", which already exists" : ""}. ` +
              "You can undo this until you close Manage tags."}
        </p>
        <div className={styles.stepActions}>
          <button
            type="submit"
            className={styles.primaryLarge}
            disabled={target === null}
            data-testid={manageTagsDialogTestIds.confirmMergeButton}
          >
            {target === null ? "Merge" : `Merge into #${target}`}
          </button>
          <button type="button" className={styles.secondaryLarge} onClick={onBack}>
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
