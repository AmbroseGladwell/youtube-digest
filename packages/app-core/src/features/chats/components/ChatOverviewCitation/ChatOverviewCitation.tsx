import type { OverviewCitationView } from "../../util/overviewCitationView.js";
import { ChatSourceChip } from "../ChatSourceChip/ChatSourceChip.js";
import { chatOverviewCitationTestIds } from "./ChatOverviewCitationTestIds.js";

export interface ChatOverviewCitationProps {
  view: OverviewCitationView;
  onFollowed: (view: Exclude<OverviewCitationView, { kind: "gone" }>, pill: HTMLButtonElement) => void;
}

export const ChatOverviewCitation = ({ view, onFollowed }: ChatOverviewCitationProps) => {
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
};
