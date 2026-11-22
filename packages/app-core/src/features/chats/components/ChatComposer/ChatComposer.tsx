import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type MutableRefObject } from "react";
import { MAX_CHAT_PINS, sourceImage, type ChatSource, type OverviewId } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useOverviewsWithStateQuery } from "../../../overviews/queries/overviewsWithStateQuery.js";
import { useProjectMembersQuery } from "../../../projects/queries/projectMembersQuery.js";
import { useProjectsQuery } from "../../../projects/queries/projectsQuery.js";
import type { PinnedItem } from "../../useChatPanel.js";
import { atQueryOf, markedPieces, sourcePickerOptions, type PickerOption } from "../../util/sourcePickerOptions.js";
import { ChatField, type ChatFieldProps } from "../ChatField/ChatField.js";
import { ChatSourceChip } from "../ChatSourceChip/ChatSourceChip.js";
import styles from "./ChatComposer.module.scss";
import { chatComposerTestIds } from "./ChatComposerTestIds.js";

export interface ChatComposerProps extends Omit<ChatFieldProps, "onAt" | "onPickerKey" | "combobox"> {
  // The chat's own overview, never offered; none on the Ask page.
  exclude?: OverviewId | undefined;
  pinned: readonly PinnedItem[];
  liveSources: readonly ChatSource[];
  onPin: (item: PinnedItem) => void;
  onUnpin: (id: string) => void;
  onRemoveSource: (id: OverviewId) => void;
  onClear: () => void;
}

const VISIBLE_CHIPS = 2;

const plural = (count: number, noun: string) => (count === 0 ? null : `${count} ${noun}${count === 1 ? "" : "s"}`);

interface RowItem {
  id: string;
  title: string;
  imageUrl: string | null;
  wide: boolean;
  project: boolean;
  deleted: boolean;
  remove: () => void;
}

// OV-354, page 1: the field with what the next question will send in one row above it, two chips
// then "+N", and the "@" picker over it, a combobox listing projects and the newest overviews,
// filtered by title as the reader types.
export const ChatComposer = ({
  exclude: own,
  pinned,
  liveSources,
  onPin,
  onUnpin,
  onRemoveSource,
  onClear,
  value,
  onChange,
  ref,
  ...field
}: ChatComposerProps) => {
  const listId = useId();
  const optionId = (index: number) => `${listId}-${index}`;
  const library = useOverviewsWithStateQuery().data ?? [];
  const projects = useProjectsQuery().data ?? [];
  const members = useProjectMembersQuery().data ?? [];
  const [picking, setPicking] = useState<{ start: number; query: string } | null>(null);
  const [active, setActive] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const input = useRef<HTMLTextAreaElement | null>(null);
  const setRefs = (node: HTMLTextAreaElement | null) => {
    input.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref != null) (ref as MutableRefObject<HTMLTextAreaElement | null>).current = node;
  };

  const overviews = library.flatMap((entry) => (entry.kind === "overview" ? [entry.overview] : []));
  const byId = new Map(overviews.map((overview) => [overview.id as string, overview]));
  const added = pinned.length + liveSources.length;
  const full = added >= MAX_CHAT_PINS;
  const exclude = new Set<string>([
    ...(own === undefined ? [] : [own]),
    ...pinned.map((item) => item.id),
    ...liveSources.map((source) => source.overviewId),
  ]);
  const { options, more } =
    picking === null ? { options: [], more: 0 } : sourcePickerOptions({ query: picking.query, projects, members, overviews, exclude });
  const open = picking !== null;

  // Opens above the field, or below it when the space above, under the sticky top bar, is too
  // small for it (OV-362).
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [below, setBelow] = useState(false);
  useLayoutEffect(() => {
    if (!open) return;
    const top = rootRef.current?.getBoundingClientRect().top ?? 0;
    const bar = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
    setBelow(top - Math.max(bar, 0) < Math.min(352, window.innerHeight * 0.5));
  }, [open]);

  const rows: RowItem[] = [
    ...pinned.map((item) => {
      const overview = item.kind === "overview" ? byId.get(item.id) : undefined;
      return {
        id: item.id,
        title: item.title,
        imageUrl: overview === undefined ? null : sourceImage(overview.source),
        wide: overview?.source.kind === "youtube",
        project: item.kind === "project",
        deleted: false,
        remove: () => onUnpin(item.id),
      };
    }),
    ...liveSources.map((source) => {
      const overview = byId.get(source.overviewId);
      return {
        id: source.overviewId,
        title: source.title,
        imageUrl: overview === undefined ? null : sourceImage(overview.source),
        wide: overview?.source.kind === "youtube",
        project: false,
        deleted: overview === undefined && library.length > 0,
        remove: () => onRemoveSource(source.overviewId),
      };
    }),
  ];

  const changed = (next: string) => {
    onChange(next);
    const caret = input.current?.selectionStart ?? next.length;
    const at = atQueryOf(next, caret);
    setPicking(at);
    setActive(0);
  };

  const choose = (option: PickerOption) => {
    if (picking !== null)
      onChange(`${value.slice(0, picking.start)}${value.slice(picking.start + 1 + picking.query.length)}`.replace(/ {2,}/g, " "));
    onPin(
      option.kind === "project"
        ? { kind: "project", id: option.project.id, title: option.project.name, count: option.count }
        : { kind: "overview", id: option.overview.id, title: option.overview.source.title },
    );
    setPicking(null);
    input.current?.focus();
  };

  const pickerKey = (event: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (!open) return false;
    if (event.key === "Escape") {
      event.preventDefault();
      setPicking(null);
      return true;
    }
    if (full || options.length === 0) return false;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => (current + (event.key === "ArrowDown" ? 1 : options.length - 1)) % options.length);
      return true;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      choose(options[active]!);
      return true;
    }
    return false;
  };

  const startAt = () => {
    const caret = input.current?.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const spaced = before === "" || /\s$/.test(before) ? "@" : " @";
    const next = `${before}${spaced}${value.slice(caret)}`;
    onChange(next);
    setPicking({ start: caret + spaced.length - 1, query: "" });
    setActive(0);
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setSelectionRange(caret + spaced.length, caret + spaced.length);
    });
  };

  const announced = full
    ? "You've added 20, the most one question can read."
    : options.length === 0
      ? "Nothing found"
      : [
          plural(options.filter((option) => option.kind === "project").length, "project"),
          plural(options.filter((option) => option.kind === "overview").length, "overview"),
        ]
          .filter((part) => part !== null)
          .join(", ");

  return (
    <div className={styles.root} ref={rootRef}>
      {open && (
        <div className={`${styles.picker} ${below ? styles.pickerBelow : ""}`} data-testid={chatComposerTestIds.picker}>
          <p className={styles.srOnly} aria-live="polite">
            {announced}
          </p>
          {full ? (
            <p className={styles.line} data-testid={chatComposerTestIds.pickerLine}>
              You&rsquo;ve added 20, the most one question can read. Remove one to add another.
            </p>
          ) : options.length === 0 ? (
            <p className={styles.line} data-testid={chatComposerTestIds.pickerLine}>
              Nothing called &lsquo;{picking.query}&rsquo;. Try a word from the title, or a project&rsquo;s name.
            </p>
          ) : (
            <ul className={styles.list} id={listId} role="listbox" aria-label="Overviews and projects">
              {options.map((option, index) => {
                const head = index === 0 || options[index - 1]!.kind !== option.kind;
                const title = option.kind === "project" ? option.project.name : option.overview.source.title;
                return (
                  <li key={option.kind === "project" ? option.project.id : option.overview.id} role="presentation">
                    {head && (
                      <p className={styles.head}>
                        {option.kind === "project" ? "Projects" : picking.query === "" ? "Recent overviews" : "Overviews"}
                      </p>
                    )}
                    <div
                      id={optionId(index)}
                      role="option"
                      aria-selected={index === active}
                      className={`${styles.option} ${index === active ? styles.active : ""}`}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => choose(option)}
                      data-testid={chatComposerTestIds.option}
                    >
                      <StrokeIcon name={option.kind === "project" ? "folder" : "fileText"} size={15} />
                      <b>
                        {markedPieces(title, picking.query).map((piece, at) =>
                          piece.marked ? <strong key={at}>{piece.text}</strong> : <span key={at}>{piece.text}</span>,
                        )}
                      </b>
                      <small>
                        {option.kind === "project"
                          ? `${option.count} ${option.count === 1 ? "overview" : "overviews"}`
                          : option.overview.source.kind === "web"
                            ? "Article"
                            : option.overview.recipe !== null
                              ? "Recipe"
                              : "Video"}
                      </small>
                    </div>
                  </li>
                );
              })}
              {more > 0 && (
                <li role="presentation" className={styles.more}>
                  {more} more · Keep typing to narrow it down.
                </li>
              )}
            </ul>
          )}
        </div>
      )}
      {rows.length > 0 && (
        <div className={styles.row} data-testid={chatComposerTestIds.sources}>
          {rows.slice(0, VISIBLE_CHIPS).map((item) => (
            <ChatSourceChip
              key={item.id}
              quiet
              title={item.title}
              label={item.title}
              imageUrl={item.imageUrl}
              wide={item.wide}
              icon={item.project ? "folder" : "fileText"}
              deleted={item.deleted}
              onRemove={item.remove}
            />
          ))}
          {rows.length > VISIBLE_CHIPS && (
            <span className={styles.moreHost}>
              <button
                type="button"
                className={`${styles.moreButton} ${moreOpen ? styles.on : ""}`}
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((current) => !current)}
                data-testid={chatComposerTestIds.more}
              >
                +{rows.length - VISIBLE_CHIPS}
              </button>
              {moreOpen && (
                <div className={styles.moreMenu} role="menu" data-testid={chatComposerTestIds.moreMenu}>
                  {rows.map((item) => (
                    <div key={item.id} className={styles.moreRow} role="none">
                      <StrokeIcon name={item.project ? "folder" : "fileText"} size={14} />
                      <span className={styles.moreTitle}>{item.title}</span>
                      <button
                        type="button"
                        role="menuitem"
                        className={styles.moreRemove}
                        aria-label={`Remove source: ${item.title}`}
                        onClick={item.remove}
                        data-testid={chatComposerTestIds.moreRemove}
                      >
                        <StrokeIcon name="close" size={13} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.clearAll}
                    onClick={() => {
                      onClear();
                      setMoreOpen(false);
                    }}
                    data-testid={chatComposerTestIds.clearAll}
                  >
                    Clear all
                  </button>
                </div>
              )}
            </span>
          )}
        </div>
      )}
      <ChatField
        {...field}
        ref={setRefs}
        value={value}
        onChange={changed}
        onAt={startAt}
        onPickerKey={pickerKey}
        combobox={{
          expanded: open && options.length > 0,
          controls: listId,
          activeDescendant: open && options.length > 0 ? optionId(active) : undefined,
        }}
      />
    </div>
  );
};
