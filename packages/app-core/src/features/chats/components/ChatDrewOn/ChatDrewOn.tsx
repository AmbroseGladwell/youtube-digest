import { sourceImage, type ChatSource, type Overview } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { Routes } from "../../../../app/Routes.js";
import { ChatSourceChip } from "../ChatSourceChip/ChatSourceChip.js";
import styles from "./ChatDrewOn.module.scss";
import { chatDrewOnTestIds } from "./ChatDrewOnTestIds.js";

export interface ChatDrewOnProps {
  how: "pinned" | "found";
  sources: readonly ChatSource[];
  overviewOf: (id: string) => Overview | null;
  onFollow: (source: ChatSource) => void;
}

// OV-354, page 2: what a sent question drew on. Pinned sits above the question, right-aligned;
// Found for you below it, left-aligned, up to three, absent when empty. A sent question keeps its
// sources, so these chips have no ×: they only open their overview.
export function ChatDrewOn({ how, sources, overviewOf, onFollow }: ChatDrewOnProps) {
  if (sources.length === 0) return null;
  return (
    <li
      className={`${styles.root} ${how === "pinned" ? styles.pinned : styles.found}`}
      data-testid={how === "pinned" ? chatDrewOnTestIds.pinned : chatDrewOnTestIds.found}
    >
      <p className={styles.label}>
        <StrokeIcon name={how === "pinned" ? "pin" : "search"} size={13} />
        {how === "pinned" ? "Pinned" : "Found for you"}
      </p>
      <div className={styles.chips}>
        {sources.map((source) => {
          const overview = overviewOf(source.overviewId);
          return (
            <ChatSourceChip
              key={source.label}
              title={source.title}
              label={`Open your overview ${source.title}`}
              imageUrl={overview === null ? null : sourceImage(overview.source)}
              wide={overview?.source.kind === "youtube"}
              deleted={overview === null}
              to={Routes.overview(source.overviewId)}
              onFollow={() => onFollow(source)}
            />
          );
        })}
      </div>
    </li>
  );
}
