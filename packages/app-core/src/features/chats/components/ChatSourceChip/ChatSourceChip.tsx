import type { ReactNode } from "react";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { StrokeIcon, type StrokeIconName } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./ChatSourceChip.module.scss";
import { chatSourceChipTestIds } from "./ChatSourceChipTestIds.js";

export interface ChatSourceChipProps {
  title: string;
  // "Key point 6", "3:21": the place cited, after the title.
  detail?: string | undefined;
  // How many more it rests on: "+2". The accessible name lists them all.
  more?: readonly string[] | undefined;
  imageUrl?: string | null | undefined;
  wide?: boolean | undefined;
  icon?: StrokeIconName | undefined;
  // Quiet: the row above the field, a surface tint with no ring. Outline: everywhere else.
  quiet?: boolean | undefined;
  deleted?: boolean | undefined;
  to?: string | undefined;
  // What the link carries to the page it opens, such as the item a citation names (OV-362).
  state?: unknown;
  onFollow?: (() => void) | undefined;
  // A place in this overview's own note: a button that moves the page, not a link.
  onPress?: ((chip: HTMLButtonElement) => void) | undefined;
  onRemove?: (() => void) | undefined;
  label: string;
  // Words after the title for the deleted state; "deleted" unless the place says otherwise.
  deletedDetail?: string | undefined;
  testId?: string | undefined;
}

// OV-354, page 2: every reference in the chat is the same chip, 28px, a mini thumbnail, the title
// cut with an ellipsis, then the place it names and "+n". One deleted since is muted and not a link.
export function ChatSourceChip({
  title,
  detail,
  more = [],
  imageUrl,
  wide,
  icon = "fileText",
  quiet,
  deleted,
  to,
  state,
  onFollow,
  onPress,
  onRemove,
  label,
  deletedDetail = "deleted",
  testId,
}: ChatSourceChipProps) {
  const className = `${styles.chip} ${quiet ? styles.quiet : styles.outline} ${deleted ? styles.deleted : ""}`;
  const thumbnail = imageUrl ? (
    <img className={`${styles.thumb} ${wide ? styles.wide : ""}`} src={imageUrl} alt="" loading="lazy" />
  ) : (
    <StrokeIcon name={icon} size={14} />
  );
  const body: ReactNode = (
    <>
      {thumbnail}
      <span className={styles.title}>{title}</span>
      {detail === undefined ? null : <span className={styles.detail}> · {detail}</span>}
      {more.length === 0 ? null : <span className={styles.detail}> +{more.length}</span>}
      {deleted ? <span className={styles.detail}> · {deletedDetail}</span> : null}
    </>
  );
  const name = more.length === 0 ? label : `${label}, and ${more.join(", ")}`;
  const content = deleted ? (
    <span className={styles.face} data-testid={testId ?? chatSourceChipTestIds.deleted}>
      {body}
    </span>
  ) : onPress !== undefined ? (
    <button type="button" className={styles.face} aria-label={name} onClick={(event) => onPress(event.currentTarget)} data-testid={testId}>
      {body}
    </button>
  ) : to !== undefined ? (
    <PageLink className={styles.face} to={to} state={state} aria-label={name} onClick={onFollow} data-testid={testId}>
      {body}
    </PageLink>
  ) : (
    <span className={styles.face} role="img" aria-label={name} data-testid={testId}>
      {body}
    </span>
  );
  return (
    <span className={className} data-testid={chatSourceChipTestIds.chip}>
      {content}
      {onRemove === undefined ? null : (
        <button
          type="button"
          className={styles.remove}
          aria-label={`Remove source: ${title}`}
          title="Remove source · Not used for your next question"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onRemove}
          data-testid={chatSourceChipTestIds.remove}
        >
          <StrokeIcon name="close" size={13} />
        </button>
      )}
    </span>
  );
}
