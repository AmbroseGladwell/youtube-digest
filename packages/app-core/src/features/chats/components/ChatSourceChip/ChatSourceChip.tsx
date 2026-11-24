import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { FloatingTip } from "../../../../components/shared/FloatingTip/FloatingTip.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { StrokeIcon, type StrokeIconName } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useFloatingTip, type FloatingTipTriggerProps } from "../../../../util/useFloatingTip.js";
import styles from "./ChatSourceChip.module.scss";
import { chatSourceChipTestIds } from "./ChatSourceChipTestIds.js";

export interface ChatSourceChipProps {
  title: string;
  marked?: ReactNode;
  detail?: string | undefined;
  more?: readonly string[] | undefined;
  imageUrl?: string | null | undefined;
  wide?: boolean | undefined;
  icon?: StrokeIconName | undefined;
  quiet?: boolean | undefined;
  stretch?: boolean | undefined;
  deleted?: boolean | undefined;
  to?: string | undefined;
  state?: unknown;
  onFollow?: (() => void) | undefined;
  onPress?: ((chip: HTMLButtonElement) => void) | undefined;
  onRemove?: (() => void) | undefined;
  label: string;
  deletedDetail?: string | undefined;
  testId?: string | undefined;
}

interface ChipFaceProps {
  body: ReactNode;
  name: string;
  deleted: boolean | undefined;
  to: string | undefined;
  state: unknown;
  onFollow: (() => void) | undefined;
  onPress: ((chip: HTMLButtonElement) => void) | undefined;
  tip: FloatingTipTriggerProps;
  testId: string | undefined;
}

const ChipFace = ({ body, name, deleted, to, state, onFollow, onPress, tip, testId }: ChipFaceProps) => {
  if (deleted) {
    return (
      <span className={styles.face} {...tip} data-testid={testId ?? chatSourceChipTestIds.deleted}>
        {body}
      </span>
    );
  }
  if (onPress !== undefined) {
    return (
      <button
        type="button"
        className={styles.face}
        {...tip}
        aria-label={name}
        onClick={(event) => onPress(event.currentTarget)}
        data-testid={testId}
      >
        {body}
      </button>
    );
  }
  if (to !== undefined) {
    return (
      <PageLink className={styles.face} {...tip} to={to} state={state} aria-label={name} onClick={onFollow} data-testid={testId}>
        {body}
      </PageLink>
    );
  }
  return (
    <span className={styles.face} {...tip} role="img" aria-label={name} data-testid={testId}>
      {body}
    </span>
  );
};

export const ChatSourceChip = ({
  title,
  marked = title,
  detail,
  more = [],
  imageUrl,
  wide,
  icon = "fileText",
  quiet,
  stretch,
  deleted,
  to,
  state,
  onFollow,
  onPress,
  onRemove,
  label,
  deletedDetail = "deleted",
  testId,
}: ChatSourceChipProps) => {
  const chip = useRef<HTMLSpanElement | null>(null);
  const titleText = useRef<HTMLSpanElement | null>(null);
  const [cut, setCut] = useState(false);
  const { shown, trigger } = useFloatingTip(cut);

  useLayoutEffect(() => {
    const shownTitle = titleText.current;
    if (shownTitle === null) {
      return;
    }
    const measure = () => setCut(shownTitle.scrollWidth > shownTitle.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(shownTitle);
    return () => observer.disconnect();
  }, [title]);

  const className = `${styles.chip} ${quiet ? styles.quiet : styles.outline} ${stretch ? styles.stretch : ""} ${deleted ? styles.deleted : ""} ${cut ? styles.cut : ""}`;
  const thumbnail = imageUrl ? (
    <img className={`${styles.thumb} ${wide ? styles.wide : ""}`} src={imageUrl} alt="" loading="lazy" />
  ) : (
    <StrokeIcon name={icon} size={14} />
  );
  const body: ReactNode = (
    <>
      {thumbnail}
      <span ref={titleText} className={styles.title} data-cuttable>
        {marked}
      </span>
      {detail === undefined ? null : <span className={styles.detail}> · {detail}</span>}
      {more.length === 0 ? null : <span className={styles.detail}> +{more.length}</span>}
      {deleted ? <span className={styles.detail}> · {deletedDetail}</span> : null}
    </>
  );
  const name = more.length === 0 ? label : `${label}, and ${more.join(", ")}`;
  return (
    <span ref={chip} className={className} data-testid={chatSourceChipTestIds.chip}>
      <ChipFace
        body={body}
        name={name}
        deleted={deleted}
        to={to}
        state={state}
        onFollow={onFollow}
        onPress={onPress}
        tip={trigger}
        testId={testId}
      />
      <FloatingTip text={title} shown={shown} anchor={chip} />
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
};
