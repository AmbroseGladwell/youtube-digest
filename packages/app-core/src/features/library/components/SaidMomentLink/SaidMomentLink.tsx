import { formatTimestamp, type TextMark, type TranscriptMoment } from "@overview/domain";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { TRANSCRIPT_MOMENT_STATE } from "../../../reader/util/transcriptMomentFromLocation.js";
import type { LibraryViewState } from "../../util/libraryViewState.js";
import styles from "./SaidMomentLink.module.scss";

export interface SaidMoment {
  moment: TranscriptMoment;
  sourceWord: "video" | "episode";
}

export interface SaidMomentLinkProps {
  said: SaidMoment;
  to: string;
  readerState: LibraryViewState;
  onClick: () => void;
  testId: string;
}

const markedText = (text: string, marks: readonly TextMark[]) => {
  const parts = [];
  let from = 0;
  for (const { start, end } of marks) {
    parts.push(text.slice(from, start), <mark key={start}>{text.slice(start, end)}</mark>);
    from = end;
  }
  parts.push(text.slice(from));
  return parts;
};

// docs/features/transcript-search.md, "In the library": the moment opens the transcript at it.
export const SaidMomentLink = ({ said, to, readerState, onClick, testId }: SaidMomentLinkProps) => (
  <PageLink
    className={styles.said}
    to={to}
    state={{ ...readerState, [TRANSCRIPT_MOMENT_STATE]: said.moment.startMs }}
    onClick={onClick}
    data-testid={testId}
  >
    <span className={styles.saidLabel}>
      <StrokeIcon name="scrollText" size={13} />
      Said in the {said.sourceWord} at {formatTimestamp(said.moment.startMs)}
    </span>
    <span className={styles.saidText}>{markedText(said.moment.text, said.moment.marks)}</span>
  </PageLink>
);
