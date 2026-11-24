import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type MutableRefObject, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { DEFAULT_PLAN, isWrittenPost, MAX_CHAT_PINS, sourceImage, type ChatSource, type OverviewId } from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useSavedCapturesQuery } from "../../../captures/queries/savedCapturesQuery.js";
import { useOverviewUsageQuery } from "../../../newOverview/queries/overviewUsageQuery.js";
import { useNextQuota } from "../../../newOverview/useNextQuota.js";
import { useOverviewsWithStateQuery } from "../../../overviews/queries/overviewsWithStateQuery.js";
import { useProjectMembersQuery } from "../../../projects/queries/projectMembersQuery.js";
import { PlansModal } from "../../../plus/components/PlansModal/PlansModal.js";
import { useProjectsQuery } from "../../../projects/queries/projectsQuery.js";
import type { PinnedItem } from "../../useChatPanel.js";
import { useChipFit } from "../../useChipFit.js";
import {
  atQueryOf,
  markedPieces,
  pickerKeyOf,
  pickerTitleOf,
  sourcePickerOptions,
  type PickerOption,
} from "../../util/sourcePickerOptions.js";
import { ChatField, type ChatFieldProps } from "../ChatField/ChatField.js";
import { ChatSourceChip } from "../ChatSourceChip/ChatSourceChip.js";
import styles from "./ChatComposer.module.scss";
import { chatComposerTestIds } from "./ChatComposerTestIds.js";

export interface ChatComposerProps extends Omit<ChatFieldProps, "onAt" | "onPickerKey" | "combobox"> {
  exclude?: OverviewId | undefined;
  pinned: readonly PinnedItem[];
  liveSources: readonly ChatSource[];
  onPin: (item: PinnedItem) => void;
  onUnpin: (id: string) => void;
  onRemoveSource: (id: OverviewId) => void;
  onClear: () => void;
}

const MOST_SHOWN = 2;

const selectableFrom = (options: readonly PickerOption[], from: number, step: 1 | -1): number => {
  for (let moved = 1; moved <= options.length; moved += 1) {
    const at = (from + step * moved + options.length * moved) % options.length;
    if (options[at]!.kind !== "saved") {
      return at;
    }
  }
  return -1;
};

const currentOf = (options: readonly PickerOption[], active: number): number => {
  const at = Math.min(active, options.length - 1);
  if (at === -1) {
    return -1;
  }
  return options[at]!.kind === "saved" ? selectableFrom(options, at, 1) : at;
};

const plural = (count: number, noun: string) => (count === 0 ? null : `${count} ${noun}${count === 1 ? "" : "s"}`);

const announcementOf = (full: boolean, options: PickerOption[]): string => {
  if (full) {
    return "You've added 20, the most one question can read.";
  }
  if (options.length === 0) {
    return "Nothing found";
  }
  return [
    plural(options.filter((option) => option.kind === "project").length, "project"),
    plural(options.filter((option) => option.kind === "overview").length, "overview"),
    plural(options.filter((option) => option.kind === "saved").length, "item without an overview yet"),
  ]
    .filter((part) => part !== null)
    .join(", ");
};

const headLabelOf = (option: PickerOption, query: string): string => {
  if (option.kind === "project") {
    return "Projects";
  }
  return query === "" ? "Recent overviews" : "Overviews";
};

const optionDetailOf = (option: Exclude<PickerOption, { kind: "saved" }>): string => {
  if (option.kind === "project") {
    return `${option.count} ${option.count === 1 ? "overview" : "overviews"}`;
  }
  if (option.overview.source.kind === "web") {
    return "Article";
  }
  if (isWrittenPost(option.overview.source)) {
    return "Post";
  }
  return option.overview.recipe !== null ? "Recipe" : "Video";
};

interface RowItem {
  id: string;
  title: string;
  imageUrl: string | null;
  wide: boolean;
  project: boolean;
  deleted: boolean;
  remove: () => void;
}

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
  const saved = useSavedCapturesQuery().data ?? [];
  const navigate = useNavigate();
  const canMake = useNextQuota()?.kind === "quota";
  const usage = useOverviewUsageQuery().data;
  const [plansOpen, setPlansOpen] = useState(false);
  const [picking, setPicking] = useState<{ start: number; query: string } | null>(null);
  const [active, setActive] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const input = useRef<HTMLTextAreaElement | null>(null);
  const setRefs = (node: HTMLTextAreaElement | null) => {
    input.current = node;
    if (typeof ref === "function") {
      ref(node);
    } else if (ref != null) {
      (ref as MutableRefObject<HTMLTextAreaElement | null>).current = node;
    }
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
    picking === null
      ? { options: [], more: 0 }
      : sourcePickerOptions({ query: picking.query, projects, members, overviews, saved, exclude });
  const open = picking !== null;
  const current = currentOf(options, active);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const [below, setBelow] = useState(false);
  useLayoutEffect(() => {
    if (!open) {
      return;
    }
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

  const { rowRef, moreRef, measuring, shown } = useChipFit(
    rows.map((item) => `${item.id}:${item.deleted}`),
    MOST_SHOWN,
  );
  const hidden = measuring ? rows.length : rows.length - shown;

  const changed = (next: string) => {
    onChange(next);
    const caret = input.current?.selectionStart ?? next.length;
    const at = atQueryOf(next, caret);
    setPicking(at);
    setActive(0);
  };

  const dropQuery = () => {
    if (picking !== null) {
      onChange(`${value.slice(0, picking.start)}${value.slice(picking.start + 1 + picking.query.length)}`.replace(/ {2,}/g, " "));
    }
    setPicking(null);
  };

  const choose = (option: PickerOption) => {
    if (option.kind === "saved") {
      return;
    }
    dropQuery();
    onPin(
      option.kind === "project"
        ? { kind: "project", id: option.project.id, title: option.project.name, count: option.count }
        : { kind: "overview", id: option.overview.id, title: option.overview.source.title },
    );
    input.current?.focus();
  };

  const pickerKey = (event: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (!open) {
      return false;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setPicking(null);
      return true;
    }
    if (full || current === -1) {
      return false;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive(selectableFrom(options, current, event.key === "ArrowDown" ? 1 : -1));
      return true;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      choose(options[current]!);
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

  const announced = announcementOf(full, options);

  const pickerBodyFor = (query: string): ReactNode => {
    if (full) {
      return (
        <p className={styles.line} data-testid={chatComposerTestIds.pickerLine}>
          You&rsquo;ve added 20, the most one question can read. Remove one to add another.
        </p>
      );
    }
    if (options.length === 0) {
      return (
        <p className={styles.line} data-testid={chatComposerTestIds.pickerLine}>
          Nothing called &lsquo;{query}&rsquo;. Try a word from the title, or a project&rsquo;s name.
        </p>
      );
    }
    return (
      <ul className={styles.list} id={listId} role="listbox" aria-label="Overviews and projects">
        {options.map((option, index) => {
          const head = index === 0 || (options[index - 1]!.kind === "project") !== (option.kind === "project");
          const title = pickerTitleOf(option);
          const marked = markedPieces(title, query).map((piece, at) =>
            piece.marked ? <strong key={at}>{piece.text}</strong> : <span key={at}>{piece.text}</span>,
          );
          return (
            <li key={pickerKeyOf(option)} role="presentation">
              {head && <p className={styles.head}>{headLabelOf(option, query)}</p>}
              {option.kind === "saved" ? (
                <>
                  <div
                    id={optionId(index)}
                    role="option"
                    aria-selected={false}
                    aria-disabled
                    className={`${styles.option} ${styles.off}`}
                    onMouseDown={(event) => event.preventDefault()}
                    data-testid={chatComposerTestIds.savedOption}
                  >
                    <StrokeIcon name="fileText" size={15} />
                    <b>{marked}</b>
                    <small>No overview yet, so it can&rsquo;t be asked about yet</small>
                  </div>
                  {canMake ? (
                    <button
                      type="button"
                      className={styles.offLink}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => void navigate(Routes.overview(option.capture.id))}
                      data-testid={chatComposerTestIds.savedOpen}
                    >
                      Make its overview
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={styles.offLink}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        dropQuery();
                        setPlansOpen(true);
                      }}
                      data-testid={chatComposerTestIds.savedGetPlus}
                    >
                      Get Plus
                    </button>
                  )}
                </>
              ) : (
                <div
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === current}
                  className={`${styles.option} ${index === current ? styles.active : ""}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(option)}
                  data-testid={chatComposerTestIds.option}
                >
                  <StrokeIcon name={option.kind === "project" ? "folder" : "fileText"} size={15} />
                  <b>{marked}</b>
                  <small>{optionDetailOf(option)}</small>
                </div>
              )}
            </li>
          );
        })}
        {more > 0 && (
          <li role="presentation" className={styles.more}>
            {more} more · Keep typing to narrow it down.
          </li>
        )}
      </ul>
    );
  };

  return (
    <div className={styles.root} ref={rootRef}>
      <PlansModal open={plansOpen} plan={usage?.plan ?? DEFAULT_PLAN} onClose={() => setPlansOpen(false)} />
      {open && (
        <div className={`${styles.picker} ${below ? styles.pickerBelow : ""}`} data-testid={chatComposerTestIds.picker}>
          <p className={styles.srOnly} aria-live="polite">
            {announced}
          </p>
          {pickerBodyFor(picking.query)}
        </div>
      )}
      {rows.length > 0 && (
        <div ref={rowRef} className={`${styles.row} ${measuring ? styles.measuring : ""}`} data-testid={chatComposerTestIds.sources}>
          {rows.slice(0, shown).map((item) => (
            <span key={item.id} className={styles.slot} data-chip-slot>
              <ChatSourceChip
                quiet
                title={item.title}
                label={item.title}
                imageUrl={item.imageUrl}
                wide={item.wide}
                icon={item.project ? "folder" : "fileText"}
                deleted={item.deleted}
                onRemove={item.remove}
              />
            </span>
          ))}
          {hidden > 0 && (
            <span className={styles.moreHost} ref={moreRef}>
              <button
                type="button"
                className={`${styles.moreButton} ${moreOpen ? styles.on : ""}`}
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((current) => !current)}
                data-testid={chatComposerTestIds.more}
              >
                +{hidden}
              </button>
              {moreOpen && !measuring && (
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
          activeDescendant: open && current !== -1 ? optionId(current) : undefined,
        }}
      />
    </div>
  );
};
