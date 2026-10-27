import { useId, useState } from "react";
import type { QueuedCapture, VideoId } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { PACE_LABEL } from "../../../playlists/util/paceCopy.js";
import type { PacedGroup } from "../../util/queueRows.js";
import { QueueRow } from "../QueueRow/QueueRow.js";
import styles from "./PacedQueueGroup.module.scss";
import { pacedQueueGroupTestIds } from "./PacedQueueGroupTestIds.js";

const SHOWN = 4;
const SHOWN_FOR_A_BACKFILL = 2;
const A_BACKFILL = 20;

export interface PacedQueueGroupProps {
  group: PacedGroup;
  waitsFor: "tomorrow" | "you";
  stacked: boolean;
  canMakeNow: boolean;
  // Null outside choosing; otherwise what is chosen (95ag).
  chosen: ReadonlySet<VideoId> | null;
  onToggle: (videoId: VideoId) => void;
  onChooseAll: (videoIds: VideoId[], chosen: boolean) => void;
  onMakeNow: (capture: QueuedCapture) => void;
  onRemove: (capture: QueuedCapture) => void;
}

const count = (n: number) => n.toLocaleString("en-GB");

// Design 95aa and 95aj: one playlist's videos waiting on its pace, or for the reader, under
// its name with its pace and today's count. A big backfill shows two and the rest behind
// "N more", so it never floods the page. On a phone or in the panel, rows keep one action
// and Remove lives in choosing (95ae).
export function PacedQueueGroup({ group, waitsFor, stacked, canMakeNow, chosen, onToggle, onChooseAll, onMakeNow, onRemove }: PacedQueueGroupProps) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const { playlist, captures } = group;
  const total = captures.length;
  const shown = expanded ? captures : captures.slice(0, total > A_BACKFILL ? SHOWN_FOR_A_BACKFILL : SHOWN);
  const more = total - shown.length;
  const allChosen = chosen !== null && captures.every((capture) => chosen.has(capture.videoId));
  const meta =
    waitsFor === "you"
      ? `Only when you choose · ${count(total)} waiting`
      : `${PACE_LABEL[group.pace]} · ${count(group.madeToday)} made today · ${count(total)} waiting`;

  return (
    <section className={styles.root} aria-label={waitsFor === "you" ? `Waiting for you from ${playlist.title}` : `Waiting on ${playlist.title}’s pace`} data-testid={pacedQueueGroupTestIds.root}>
      <div className={styles.head}>
        <span className={styles.headText}>
          <h3 className={styles.title} data-testid={pacedQueueGroupTestIds.title}>
            {playlist.title}
          </h3>
          <span className={styles.meta} data-testid={pacedQueueGroupTestIds.meta}>
            {meta}
          </span>
        </span>
        {chosen !== null && (
          <button
            type="button"
            className={`${styles.chooseAll} ${stacked ? styles.chooseAllStacked : ""}`}
            onClick={() => onChooseAll(captures.map((capture) => capture.videoId), !allChosen)}
            aria-label={allChosen ? `Clear choices from ${playlist.title}` : `Choose all ${count(total)} from ${playlist.title}`}
            data-testid={pacedQueueGroupTestIds.chooseAllButton}
          >
            {allChosen ? "Clear" : `Choose all ${count(total)}`}
          </button>
        )}
      </div>
      <ol className={styles.list} id={listId}>
        {shown.map((capture) => (
          <QueueRow
            key={capture.videoId}
            capture={capture}
            state={waitsFor === "you" ? "forYou" : "tomorrow"}
            position={null}
            dense
            showFrom={false}
            {...(canMakeNow ? { onMakeNow: () => onMakeNow(capture) } : {})}
            {...(stacked ? {} : { onRemove: () => onRemove(capture) })}
            {...(chosen === null ? {} : { choice: { checked: chosen.has(capture.videoId), onToggle: () => onToggle(capture.videoId) } })}
          />
        ))}
      </ol>
      {more > 0 && (
        <button
          type="button"
          className={`${styles.more} ${stacked ? styles.moreStacked : ""}`}
          onClick={() => setExpanded(true)}
          aria-expanded={false}
          aria-controls={listId}
          data-testid={pacedQueueGroupTestIds.moreButton}
        >
          {count(more)} more from {playlist.title}
          <StrokeIcon name="chevronDown" size={14} />
        </button>
      )}
    </section>
  );
}
