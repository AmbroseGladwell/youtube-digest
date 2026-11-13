import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  KEY_POINTS_SECTION,
  SOURCE_STEPS_SECTION,
  WATCH_ANYWAY_SECTION,
  formatTimestamp,
  youtubeTimestampUrl,
  type NoteLine,
  type TimeRange,
  type VideoSource,
} from "@overview/domain";

export type RangeKind = "keyPoint" | "standsOut" | "watchAnyway" | "recipeStep" | "sourceStep";

// What a line of the note points at, for the tag at its end. One of the steps a source gives
// names its number, counted from the note's lines (design 250d).
export const noteLineRange = (line: NoteLine, lines: readonly NoteLine[] = []): { kind: RangeKind; about: string; step?: number } => {
  if (line.section === SOURCE_STEPS_SECTION) {
    const steps = lines.filter((each) => each.section === SOURCE_STEPS_SECTION && !each.heading);
    const at = steps.indexOf(line);
    return { kind: "sourceStep", about: line.text, ...(at === -1 ? {} : { step: at + 1 }) };
  }
  return {
    kind: line.section === WATCH_ANYWAY_SECTION ? "watchAnyway" : line.section === KEY_POINTS_SECTION ? "keyPoint" : "standsOut",
    about: line.text,
  };
};
import { useSeekPlayback } from "../../../../app/PlaybackContext.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useDismissOnOutside } from "../../../../util/useDismissOnOutside.js";
import { useOverviewPageAnalytics } from "../../../analytics/OverviewAnalyticsContext.js";
import { formatTimeRange } from "../../../overviews/util/formatTimeRange.js";
import styles from "./LineRangeTag.module.scss";
import { lineRangeTagTestIds } from "./LineRangeTagTestIds.js";

export interface LineRangeTagProps {
  kind: RangeKind;
  // The words the stretch belongs to, repeated at the top of the phone's sheet.
  about: string;
  // A method step, or one of the steps a source gives, names itself in the tag's label,
  // "Step 4 at 4:12" (designs 122g, 250d).
  step?: number;
  // The video beside the panel is inside this stretch (designs 122i, 250e).
  playing?: boolean;
  range: TimeRange;
  video: VideoSource;
  active: boolean;
  asSheet: boolean;
  canReadTranscript: boolean;
  onOpenTranscriptAt: (positionMs: number) => void;
  // An episode's note: the time is a play chip that jumps the episode's own player, and Listen
  // to it anyway's range plays and stops at its end (designs 106p, 106s).
  direct?: boolean;
}

type Reach = "skip" | "youtube" | "transcript";

const ROOM_FOR_THE_PLAYER_BAR = 128;
const STICKY_CHROME = ["--masthead-height", "--reader-tabs-height"];

const stickyChromeHeight = (element: HTMLElement) => {
  const style = getComputedStyle(element);
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return STICKY_CHROME.reduce((sum, property) => {
    const value = style.getPropertyValue(property).trim();
    return sum + (parseFloat(value) || 0) * (value.endsWith("rem") ? rem : 1);
  }, 0);
};

// docs/features/novelty-scale.md, "The time is the handle".
export function LineRangeTag({
  kind,
  about,
  step,
  playing = false,
  range,
  video,
  active,
  asSheet,
  canReadTranscript,
  onOpenTranscriptAt,
  direct = false,
}: LineRangeTagProps) {
  const [open, setOpen] = useState(false);
  const [upward, setUpward] = useState(false);
  const root = useRef<HTMLSpanElement | null>(null);
  const tag = useRef<HTMLButtonElement | null>(null);
  const menu = useRef<HTMLDivElement | null>(null);
  const seek = useSeekPlayback(video.id);
  const analytics = useOverviewPageAnalytics();

  const watchAnyway = kind === "watchAnyway";
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
      analytics.readAlong.rangeFollowed({ line: kind, by });
    }
    setOpen(false);
  };

  if (direct && seek !== null) {
    return (
      <span className={styles.root} onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className={`${styles.playChip} ${watchAnyway ? styles.playChipRange : ""} ${playing ? styles.tagPlaying : ""}`}
          onClick={() => {
            followed("skip");
            if (watchAnyway) seek(range.startMs, range.endMs);
            else seek(range.startMs);
          }}
          aria-label={watchAnyway ? `Play ${stretch}` : `Play the episode from ${start}`}
          data-testid={lineRangeTagTestIds.playChip}
        >
          <StrokeIcon name="play" size={11} />
          {watchAnyway ? `Play ${stretch}` : start}
        </button>
        {watchAnyway && <span className={styles.rangeLength}>{rangeLength(range)}, then it stops</span>}
      </span>
    );
  }

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
          aria-label={`${step === undefined ? "Skip" : "Play"} the video ${step === undefined ? "to" : "from"} ${start}`}
          data-testid={lineRangeTagTestIds.skipButton}
        >
          <StrokeIcon name="skipForward" size={iconSize} />
          <span className={styles.itemLabel}>
            {step === undefined ? "Skip to" : "Play from"} {start}
          </span>
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
        <p className={styles.sheetLine}>{about}</p>
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
        className={`${styles.tag} ${watchAnyway ? styles.tagFilled : ""} ${active ? styles.tagOnActiveLine : ""} ${playing ? styles.tagPlaying : ""}`}
        aria-haspopup={asSheet ? "dialog" : "menu"}
        aria-expanded={open}
        aria-label={
          step === undefined
            ? `${watchAnyway ? stretch : start}, go to the video or transcript`
            : `Step ${step} at ${start}${playing ? ", playing now" : ""}: watch or read the transcript`
        }
        onClick={() => setOpen(!open)}
        data-testid={lineRangeTagTestIds.tag}
      >
        {watchAnyway ? stretch : start}
        {playing && " · Playing"}
      </button>
      {open && portalled(asSheet, asSheet ? sheet : popover)}
    </span>
  );
}

// "8 min", how long a range plays before it stops (design 106s).
const rangeLength = ({ startMs, endMs }: TimeRange): string => {
  const minutes = Math.max(1, Math.round((endMs - startMs) / 60_000));
  return `${minutes} min`;
};

const portalled = (asSheet: boolean, content: ReactNode) => (asSheet ? createPortal(content, document.body) : content);
