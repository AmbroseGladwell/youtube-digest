import { useEffect, useId, useState } from "react";
import { Routes } from "../../../../app/Routes.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import type { PickedOverview } from "../../useAskOver.js";
import { ChatSourceChip } from "../ChatSourceChip/ChatSourceChip.js";
import styles from "./AskPickingWait.module.scss";
import { askPickingWaitTestIds } from "./AskPickingWaitTestIds.js";

export const SLOW_PICKING_MS = 10_000;

export interface AskPickingWaitProps {
  // Choosing what to read, reading what was chosen, or read, once the answer has begun.
  phase: "choosing" | "reading" | "read";
  picked: readonly PickedOverview[];
  imageOf: (overviewId: string) => { url: string | null; wide: boolean };
  holds: (overviewId: string) => boolean;
  onOpened: () => void;
  onFollow: () => void;
}

type MarkState = "on" | "todo" | "done";

const overviews = (count: number) => `${count} ${count === 1 ? "overview" : "overviews"}`;

// The mark as the loader (354v): its circle an orange arc turning over its bar while a step runs;
// a filled circle with a tick drawn in once it is done; faint, and still, before it starts.
function Mark({ state }: { state: MarkState }) {
  return (
    <svg className={`${styles.mark} ${styles[state]}`} viewBox="0 0 30 30" fill="none" aria-hidden="true">
      {state === "done" ? (
        <>
          <circle className={styles.fill} cx="15" cy="13" r="8" />
          <path className={styles.tick} d="M10.5 13.5l3 3 6-6.5" />
        </>
      ) : (
        <>
          <g className={styles.arc}>
            <circle cx="15" cy="13" r="8" strokeDasharray="36 50" />
          </g>
          <rect className={styles.bar} x="8" y="25" width="14" height="2.5" rx="1.25" />
        </>
      )}
    </svg>
  );
}

// OV-354, page 3 (354v, the mp4): a short list in small muted type while a library or project
// question chooses what to read, then reads it, the titles named by code from the ids; once the
// answer begins it folds into one "Read 5 overviews" line that opens to show them as chips.
export function AskPickingWait({ phase, picked, imageOf, holds, onOpened, onFollow }: AskPickingWaitProps) {
  const [slow, setSlow] = useState(false);
  const [open, setOpen] = useState(false);
  const chipsId = useId();

  useEffect(() => {
    setSlow(false);
    if (phase !== "choosing") {
      return;
    }
    const timer = setTimeout(() => setSlow(true), SLOW_PICKING_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  if (phase === "read") {
    return (
      <div className={styles.folded} data-testid={askPickingWaitTestIds.root}>
        <button
          type="button"
          className={styles.readLine}
          aria-expanded={open}
          aria-controls={chipsId}
          onClick={() => {
            if (!open) {
              onOpened();
            }
            setOpen(!open);
          }}
          data-testid={askPickingWaitTestIds.read}
        >
          <Mark state="done" />
          Read {overviews(picked.length)}
          <span className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}>
            <StrokeIcon name="chevronDown" size={14} />
          </span>
        </button>
        {open && (
          <div className={styles.chips} id={chipsId} data-testid={askPickingWaitTestIds.readChips}>
            {picked.map((overview) => {
              const image = imageOf(overview.overviewId);
              const held = holds(overview.overviewId);
              return (
                <ChatSourceChip
                  key={overview.overviewId}
                  title={overview.title}
                  label={overview.title}
                  imageUrl={image.url}
                  wide={image.wide}
                  deleted={!held}
                  deletedDetail="an overview you deleted"
                  {...(held ? { to: Routes.overview(overview.overviewId), onFollow } : {})}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const reading = phase === "reading";
  return (
    <div className={styles.root} data-testid={askPickingWaitTestIds.root}>
      <p className={`${styles.step} ${reading ? styles.stepDone : styles.stepOn}`} data-testid={askPickingWaitTestIds.step}>
        <Mark state={reading ? "done" : "on"} />
        {reading ? (
          "Chosen"
        ) : (
          <span>
            Choosing which overviews to read<small> · A few seconds</small>
          </span>
        )}
      </p>
      {!reading && slow && (
        <p className={styles.slow} data-testid={askPickingWaitTestIds.slow}>
          Still choosing, slow connection
        </p>
      )}
      <p className={`${styles.step} ${reading ? styles.stepOn : styles.stepTodo}`} data-testid={askPickingWaitTestIds.step}>
        <Mark state={reading ? "on" : "todo"} />
        <span>
          {reading ? `Reading ${overviews(picked.length)}` : "Reading the overviews"}
          {reading && <small> · Then the answer</small>}
        </span>
      </p>
      {reading && (
        <ul className={styles.titles}>
          {picked.map((overview, index) => {
            const image = imageOf(overview.overviewId);
            return (
              <li key={overview.overviewId} style={{ animationDelay: `${index * 80}ms` }} data-testid={askPickingWaitTestIds.title}>
                {image.url === null ? (
                  <span className={`${styles.thumb} ${image.wide ? styles.thumbWide : ""}`} aria-hidden="true" />
                ) : (
                  <img className={`${styles.thumb} ${image.wide ? styles.thumbWide : ""}`} src={image.url} alt="" loading="lazy" />
                )}
                <span className={styles.titleText}>{overview.title}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
