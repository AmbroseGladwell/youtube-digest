import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { ChatSourceKind } from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useDismissOnOutside } from "../../../../util/useDismissOnOutside.js";
import { useLongPressTip } from "../../../../util/useLongPressTip.js";
import type { AskQuestionOverview } from "../../types/AskQuestion.js";
import styles from "./AskQuestionReferences.module.scss";
import { askQuestionReferencesTestIds } from "./AskQuestionReferencesTestIds.js";

export interface AskQuestionReferencesProps {
  overviews: readonly [AskQuestionOverview, AskQuestionOverview];
  good: boolean;
  onOpened: () => void;
  onToggleGood: () => void;
  onNotUseful: () => void;
  onHide: () => void;
}

const KIND_NAMES: Record<ChatSourceKind, string> = {
  video: "Video",
  episode: "Podcast episode",
  article: "Article",
  recipe: "Recipe",
};

const MENU_ITEM = "[role=menuitem], [role=menuitemcheckbox]";

export const askQuestionReferencesName = ([first, second]: AskQuestionReferencesProps["overviews"]): string =>
  `About this question: draws on ${first.title} and ${second.title}`;

const Thumb = ({ overview }: { overview: AskQuestionOverview }) => {
  const [failed, setFailed] = useState(false);
  const shape = `${styles.thumb} ${overview.wide ? styles.wide : ""}`;
  return overview.imageUrl === null || failed ? (
    <span className={`${shape} ${styles.blank}`} aria-hidden="true" />
  ) : (
    <img className={shape} src={overview.imageUrl} alt="" loading="lazy" onError={() => setFailed(true)} />
  );
};

export const AskQuestionReferences = ({ overviews, good, onOpened, onToggleGood, onNotUseful, onHide }: AskQuestionReferencesProps) => {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  const button = useRef<HTMLButtonElement | null>(null);
  const menu = useRef<HTMLDivElement | null>(null);
  const press = useLongPressTip(!open);

  const close = () => {
    setOpen(false);
    button.current?.focus({ preventScroll: true });
  };
  useDismissOnOutside(open, close, root);
  const closeAnd = (act: () => void) => () => {
    close();
    act();
  };

  useEffect(() => {
    if (open) {
      menu.current?.querySelector<HTMLElement>(MENU_ITEM)?.focus({ preventScroll: true });
    }
  }, [open]);

  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menu.current?.querySelectorAll<HTMLElement>(MENU_ITEM) ?? []);
    const current = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    const target = { ArrowDown: (current + 1) % items.length, ArrowUp: (current - 1 + items.length) % items.length }[event.key];
    if (target === undefined) {
      return;
    }
    event.preventDefault();
    items[target]?.focus();
  };

  return (
    <div className={styles.root} ref={root}>
      <button
        type="button"
        ref={button}
        className={`${styles.button} ${open ? styles.open : ""}`}
        aria-label={askQuestionReferencesName(overviews)}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        {...press}
        data-testid={askQuestionReferencesTestIds.button}
      >
        <span className={styles.thumbs}>
          {overviews.map((overview) => (
            <Thumb key={overview.id} overview={overview} />
          ))}
        </span>
        <span className={styles.chevron}>
          <StrokeIcon name="chevronDown" size={13} />
        </span>
        <span className={styles.tip} aria-hidden="true" data-testid={askQuestionReferencesTestIds.tip}>
          About this question
        </span>
      </button>
      {open && (
        <div
          ref={menu}
          className={styles.menu}
          role="menu"
          aria-label="About this question"
          onKeyDown={moveFocus}
          data-testid={askQuestionReferencesTestIds.menu}
        >
          <div role="group" aria-label="This question draws on">
            <p className={styles.header} aria-hidden="true">
              This question draws on
            </p>
            {overviews.map((overview) => (
              <PageLink
                key={overview.id}
                className={styles.item}
                role="menuitem"
                to={Routes.overview(overview.id)}
                aria-label={overview.title}
                onClick={onOpened}
                data-testid={askQuestionReferencesTestIds.item}
              >
                <Thumb overview={overview} />
                <span className={styles.title}>{overview.title}</span>
                <small className={styles.kind}>{KIND_NAMES[overview.kind]}</small>
              </PageLink>
            ))}
          </div>
          <div role="separator" className={styles.separator} />
          <div role="group" aria-label="Feedback on this question">
            <button
              type="button"
              className={`${styles.item} ${styles.action} ${good ? styles.checked : ""}`}
              role="menuitemcheckbox"
              aria-checked={good}
              onClick={onToggleGood}
              data-testid={askQuestionReferencesTestIds.good}
            >
              <span className={styles.icon}>
                <StrokeIcon name="thumbsUp" size={15} />
              </span>
              Good question
            </button>
            <button
              type="button"
              className={`${styles.item} ${styles.action}`}
              role="menuitem"
              onClick={closeAnd(onNotUseful)}
              data-testid={askQuestionReferencesTestIds.notUseful}
            >
              <span className={styles.icon}>
                <StrokeIcon name="thumbsDown" size={15} />
              </span>
              Not useful
            </button>
            <button
              type="button"
              className={`${styles.item} ${styles.action}`}
              role="menuitem"
              onClick={closeAnd(onHide)}
              data-testid={askQuestionReferencesTestIds.hide}
            >
              <span className={styles.icon}>
                <StrokeIcon name="close" size={15} />
              </span>
              Hide
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
