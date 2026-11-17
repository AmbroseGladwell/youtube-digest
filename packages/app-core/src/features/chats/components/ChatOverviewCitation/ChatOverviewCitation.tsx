import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import type { OverviewCitationView } from "../../util/overviewCitationView.js";
import styles from "./ChatOverviewCitation.module.scss";
import { chatOverviewCitationTestIds } from "./ChatOverviewCitationTestIds.js";

export interface ChatOverviewCitationProps {
  view: OverviewCitationView;
  onFollowed: (view: Exclude<OverviewCitationView, { kind: "gone" }>, pill: HTMLButtonElement) => void;
}

// Design 319a, 319x, 319z: a part of the overview an answer rests on, as an outlined pill named
// by the note's own heading, apart from the video's filled pills. One whose item was rewritten
// since still leads to its section; one whose section is gone is no longer a link.
export function ChatOverviewCitation({ view, onFollowed }: ChatOverviewCitationProps) {
  if (view.kind === "gone") {
    return (
      <span className={styles.gone} data-testid={chatOverviewCitationTestIds.gone}>
        <StrokeIcon name="fileX" size={14} />
        {view.section} · no longer in the overview
      </span>
    );
  }
  const changed = view.kind === "changed";
  return (
    <button
      type="button"
      className={styles.pill}
      aria-label={changed ? `Go to ${view.label} in the overview, since changed` : `Go to ${view.label} in the overview: ${view.opening}`}
      onClick={(event) => onFollowed(view, event.currentTarget)}
      data-testid={chatOverviewCitationTestIds.pill}
    >
      <StrokeIcon name="fileText" size={14} />
      <span className={styles.label}>{view.label}</span>
      {changed && (
        <span className={styles.changed} data-testid={chatOverviewCitationTestIds.changed}>
          {"· since changed"}
        </span>
      )}
    </button>
  );
}
