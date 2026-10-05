import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  KEY_POINTS_SECTION,
  WATCH_ANYWAY_SECTION,
  formatTimestamp,
  youtubeTimestampUrl,
  type NoteLine,
  type TimeRange,
  type VideoSource,
} from "@overview/domain";
import { useSeekPlayback } from "../../../../app/PlaybackContext.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useDismissOnOutside } from "../../../../util/useDismissOnOutside.js";
import { useOverviewPageAnalytics } from "../../../analytics/OverviewAnalyticsContext.js";
import { formatTimeRange } from "../../../overviews/util/formatTimeRange.js";
import styles from "./LineRangeTag.module.scss";
import { lineRangeTagTestIds } from "./LineRangeTagTestIds.js";

export interface LineRangeTagProps {
  line: NoteLine;
  range: TimeRange;
  video: VideoSource;
  active: boolean;
  asSheet: boolean;
  canReadTranscript: boolean;
  onOpenTranscriptAt: (positionMs: number) => void;
}

type Reach = "skip" | "youtube" | "transcript";

const ROOM_FOR_THE_PLAYER_BAR = 128;
const STICKY_CHROME = ["--masthead-height", "--reader-masthead-height", "--reader-tabs-height"];

const stickyChromeHeight = (element: HTMLElement) => {
  const style = getComputedStyle(element);
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return STICKY_CHROME.reduce((sum, property) => {
    const value = style.getPropertyValue(property).trim();
    return sum + (parseFloat(value) || 0) * (value.endsWith("rem") ? rem : 1);
  }, 0);
};

// docs/features/novelty-scale.md, "The time is the handle".
export function LineRangeTag({ line, range, video, active, asSheet, canReadTranscript, onOpenTranscriptAt }: LineRangeTagProps) {
  const [open, setOpen] = useState(false);
  const [upward, setUpward] = useState(false);
  const root = useRef<HTMLSpanElement | null>(null);
  const tag = useRef<HTMLButtonElement | null>(null);
  const menu = useRef<HTMLDivElement | null>(null);
  const seek = useSeekPlayback(video.id);
  const analytics = useOverviewPageAnalytics();

  const watchAnyway = line.section === WATCH_ANYWAY_SECTION;
  const start = formatTimestamp(range.startMs);
  const stretch = formatTimeRange(range.startMs, range.endMs);

  const close = () => {
    setOpen(false);
    tag.current?.focus();
  };
  useDismissOnOutside(open, close, root, menu);

  useLayoutEffect(() => {
    if (!open || asSheet || !tag.current || !menu.current) {
      return;
    }
    const { top, bottom } = tag.current.getBoundingClientRect();
    const height = menu.current.offsetHeight;
    const fitsBelow = bottom + height <= window.innerHeight - ROOM_FOR_THE_PLAYER_BAR;
    const fitsAbove = top - height >= stickyChromeHeight(tag.current);
    setUpward(!fitsBelow && fitsAbove);
    if (!fitsBelow && !fitsAbove) {
      menu.current.scrollIntoView({ block: "nearest" });
    }
  }, [open, asSheet]);

  useEffect(() => {
    if (open) {
      items()[0]?.focus();
    }
  }, [open]);

  const items = () => Array.from(menu.current?.querySelectorAll<HTMLElement>("[data-range-item]") ?? []);

  const followed = (by: Reach) => {
    if (watchAnyway) {
      analytics.watchAnyway.followed({ by });
    } else {
      analytics.readAlong.rangeFollowed({ line: line.section === KEY_POINTS_SECTION ? "keyPoint" : "standsOut", by });
    }
    setOpen(false);
  };

  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    const all = items();
    const current = all.indexOf(document.activeElement as HTMLElement);
    const last = all.length - 1;
    const target = {
      ArrowDown: current === last ? 0 : current + 1,
      ArrowUp: current <= 0 ? last : current - 1,
      Home: 0,
      End: last,
    }[event.key];
    if (target !== undefined) {
      event.preventDefault();
      all[target]?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  const itemClass = asSheet ? styles.sheetItem : styles.item;
  const firstItemClass = asSheet ? `${styles.sheetItem} ${styles.sheetItemFirst}` : styles.item;
  const itemRole = asSheet ? undefined : "menuitem";
  const iconSize = asSheet ? 18 : 16;

  const actions = (
    <>
      {seek === null ? (
        <a
          className={firstItemClass}
          role={itemRole}
          data-range-item
          href={youtubeTimestampUrl(video.url, range.startMs)}
          target="_blank"
          rel="noopener"
          onClick={() => followed("youtube")}
          aria-label={`Watch from ${start} on YouTube, opens in a new tab`}
          data-testid={lineRangeTagTestIds.watchLink}
        >
          <StrokeIcon name="openOut" size={iconSize} />
          <span className={styles.itemLabel}>Watch from {start}</span>
        </a>
      ) : (
        <button
          type="button"
          className={firstItemClass}
          role={itemRole}
          data-range-item
          onClick={() => {
            followed("skip");
            seek(range.startMs);
          }}
          aria-label={`Skip the video to ${start}`}
          data-testid={lineRangeTagTestIds.skipButton}
        >
          <StrokeIcon name="skipForward" size={iconSize} />
          <span className={styles.itemLabel}>Skip to {start}</span>
        </button>
      )}
      {canReadTranscript && (
        <button
          type="button"
          className={itemClass}
          role={itemRole}
          data-range-item
          onClick={() => {
            followed("transcript");
            onOpenTranscriptAt(range.startMs);
          }}
          aria-label={`Read the transcript from ${start}`}
          data-testid={lineRangeTagTestIds.transcriptButton}
        >
          <StrokeIcon name="scrollText" size={iconSize} />
          <span className={styles.itemLabel}>Read in transcript</span>
        </button>
      )}
    </>
  );

  const popover = (
    <div
      ref={menu}
      className={`${styles.menu} ${upward ? styles.menuUpward : ""}`}
      role="menu"
      aria-label={`${start} to ${formatTimestamp(range.endMs)}`}
      onKeyDown={moveFocus}
      data-testid={lineRangeTagTestIds.menu}
    >
      <p className={styles.menuRange} data-testid={lineRangeTagTestIds.menuRange}>
        {stretch} in the video
      </p>
      {actions}
    </div>
  );

  const sheet = (
    <>
      <span className={styles.scrim} onClick={close} aria-hidden="true" data-testid={lineRangeTagTestIds.scrim} />
      <div
        ref={menu}
        className={styles.sheet}
        role="dialog"
        aria-label={`${start} to ${formatTimestamp(range.endMs)}`}
        onKeyDown={moveFocus}
        data-testid={lineRangeTagTestIds.menu}
      >
        <span className={styles.handle} aria-hidden="true" />
        <p className={styles.sheetLine}>{line.text}</p>
        <p className={styles.sheetRange} data-testid={lineRangeTagTestIds.menuRange}>
          {stretch} in the video
        </p>
        {actions}
      </div>
    </>
  );

  return (
    <span className={styles.root} ref={root} onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        ref={tag}
        className={`${styles.tag} ${watchAnyway ? styles.tagFilled : ""} ${active ? styles.tagOnActiveLine : ""}`}
        aria-haspopup={asSheet ? "dialog" : "menu"}
        aria-expanded={open}
        aria-label={`${watchAnyway ? stretch : start}, go to the video or transcript`}
        onClick={() => setOpen(!open)}
        data-testid={lineRangeTagTestIds.tag}
      >
        {watchAnyway ? stretch : start}
      </button>
      {open && portalled(asSheet, asSheet ? sheet : popover)}
    </span>
  );
}

const portalled = (asSheet: boolean, content: ReactNode) => (asSheet ? createPortal(content, document.body) : content);
