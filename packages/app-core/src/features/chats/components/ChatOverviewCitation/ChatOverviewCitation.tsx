import type { OverviewCitationView } from "../../util/overviewCitationView.js";
import { ChatSourceChip } from "../ChatSourceChip/ChatSourceChip.js";
import { chatOverviewCitationTestIds } from "./ChatOverviewCitationTestIds.js";

export interface ChatOverviewCitationProps {
  view: OverviewCitationView;
  onFollowed: (view: Exclude<OverviewCitationView, { kind: "gone" }>, pill: HTMLButtonElement) => void;
}

// Design 319a, 319x, 319z as the shared chip (OV-354, page 2): a part of the overview an answer
// rests on, named by the note's own heading. One whose item was rewritten since still leads to
// its section; one whose section is gone is muted and no longer a button.
export function ChatOverviewCitation({ view, onFollowed }: ChatOverviewCitationProps) {
  if (view.kind === "gone") {
    return (
      <ChatSourceChip
        title={view.section}
        label={view.section}
        deleted
        deletedDetail="no longer in the overview"
        testId={chatOverviewCitationTestIds.gone}
      />
    );
  }
  const changed = view.kind === "changed";
  return (
    <ChatSourceChip
      title={view.label}
      detail={changed ? "since changed" : undefined}
      label={changed ? `Go to ${view.label} in the overview, since changed` : `Go to ${view.label} in the overview: ${view.opening}`}
      onPress={(chip) => onFollowed(view, chip)}
      testId={chatOverviewCitationTestIds.pill}
    />
  );
}
