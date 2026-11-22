import { formatTimestamp, type OtherOverviewCitation, type OverviewPart } from "@overview/domain";
import { CITED_PLACE_STATE } from "../../../reader/util/citedPlaceFromLocation.js";
import { Routes } from "../../../../app/Routes.js";
import { ChatSourceChip } from "../ChatSourceChip/ChatSourceChip.js";
import { chatOtherOverviewCitationTestIds } from "./ChatOtherOverviewCitationTestIds.js";

export interface ChatOtherOverviewCitationProps {
  citation: OtherOverviewCitation;
  held: boolean;
  imageUrl?: string | null | undefined;
  wide?: boolean | undefined;
  onFollowed: (citation: OtherOverviewCitation) => void;
}

const NUMBERED: Partial<Record<OverviewPart, string>> = { keyPoint: "Key point", step: "Step", method: "Method step", chapter: "Chapter" };
const SECTION: Record<OverviewPart, string> = {
  verdict: "Verdict",
  dubiousClaim: "Why it's dubious",
  keyPoint: "Key points",
  step: "The steps it gives",
  howToApply: "How to apply",
  selling: "What it's selling",
  watchAnyway: "Watch it anyway",
  chapter: "Chapters",
  ingredient: "Ingredients",
  method: "Method",
};

export const otherOverviewCitationPlace = ({ item, range }: Pick<OtherOverviewCitation, "item" | "range">): string | undefined => {
  if (range !== undefined) {
    return formatTimestamp(range.startMs);
  }
  if (item === null) {
    return undefined;
  }
  const numbered = NUMBERED[item.part];
  return numbered === undefined ? SECTION[item.part] : `${numbered} ${item.index + 1}`;
};

// Another of the reader's overviews an answer drew on (OV-355), named by the title it had when
// cited, as the shared chip (OV-354, page 2) linking to it; muted, and not a link, once deleted.
export function ChatOtherOverviewCitation({ citation, held, imageUrl, wide, onFollowed }: ChatOtherOverviewCitationProps) {
  const place = otherOverviewCitationPlace(citation);
  const label = place === undefined ? citation.title : `${citation.title} · ${place}`;
  return (
    <ChatSourceChip
      title={citation.title}
      detail={held ? place : undefined}
      label={`Open your overview ${label}`}
      imageUrl={held ? imageUrl : null}
      wide={wide}
      deleted={!held}
      deletedDetail="an overview you deleted"
      to={Routes.overview(citation.overviewId)}
      {...(citation.item === null ? {} : { state: { [CITED_PLACE_STATE]: citation.item } })}
      onFollow={() => onFollowed(citation)}
      testId={held ? chatOtherOverviewCitationTestIds.link : chatOtherOverviewCitationTestIds.gone}
    />
  );
}
