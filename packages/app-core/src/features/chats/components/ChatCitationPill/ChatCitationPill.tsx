import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { formatTimestamp, youtubeMomentUrl, youtubeTimestampUrl, type TimeRange, type VideoSource } from "@overview/domain";
import { useSeekPlayback } from "../../../../app/PlaybackContext.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useDismissOnOutside } from "../../../../util/useDismissOnOutside.js";
import { formatTimeRange } from "../../../overviews/util/formatTimeRange.js";
import styles from "./ChatCitationPill.module.scss";
import { chatCitationPillTestIds } from "./ChatCitationPillTestIds.js";

export interface ChatCitationPillProps {
  range: TimeRange;
  video: VideoSource;
  onFollowed: (range: TimeRange) => void;
  onOpenTranscriptAt: (positionMs: number) => void;
}

export const ChatCitationPill = ({ range, video, onFollowed, onOpenTranscriptAt }: ChatCitationPillProps) => {
  const seek = useSeekPlayback(video.id);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement | null>(null);
  const pill = useRef<HTMLButtonElement | null>(null);
  const menu = useRef<HTMLDivElement | null>(null);
  const start = formatTimestamp(range.startMs);
  const end = formatTimestamp(range.endMs);

  const close = () => {
    setOpen(false);
    pill.current?.focus();
  };
  useDismissOnOutside(open, close, root, menu);

  useEffect(() => {
    if (open) {
      menu.current?.querySelector<HTMLElement>("[data-citation-item]")?.focus();
    }
  }, [open]);

  const follow = () => {
    onFollowed(range);
    if (seek !== null) {
      seek(range.startMs);
    } else {
      setOpen(!open);
    }
  };

  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menu.current?.querySelectorAll<HTMLElement>("[data-citation-item]") ?? []);
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
    <span className={styles.root} ref={root}>
      <button
        type="button"
        ref={pill}
        className={styles.pill}
        aria-label={`Play the video, ${start} to ${end}`}
        aria-haspopup={seek === null ? "menu" : undefined}
        aria-expanded={seek === null ? open : undefined}
        onClick={follow}
        data-testid={chatCitationPillTestIds.pill}
      >
        <StrokeIcon name="play" size={13} />
        {formatTimeRange(range.startMs, range.endMs)}
      </button>
      {open && (
        <div
          ref={menu}
          className={styles.menu}
          role="menu"
          aria-label={`${start} to ${end}`}
          onKeyDown={moveFocus}
          data-testid={chatCitationPillTestIds.menu}
        >
          {youtubeMomentUrl(video.url, range.startMs) !== null && (
            <a
              className={styles.item}
              role="menuitem"
              data-citation-item
              href={youtubeTimestampUrl(video.url, range.startMs)}
              target="_blank"
              rel="noopener"
              onClick={() => setOpen(false)}
              aria-label={`Watch from ${start} on YouTube, opens in a new tab`}
              data-testid={chatCitationPillTestIds.watchLink}
            >
              <StrokeIcon name="openOut" size={16} />
              Watch from {start}
            </a>
          )}
          <button
            type="button"
            className={styles.item}
            role="menuitem"
            data-citation-item
            onClick={() => {
              setOpen(false);
              onOpenTranscriptAt(range.startMs);
            }}
            aria-label={`Read the transcript from ${start}`}
            data-testid={chatCitationPillTestIds.transcriptButton}
          >
            <StrokeIcon name="scrollText" size={16} />
            Read in transcript
          </button>
        </div>
      )}
    </span>
  );
};
