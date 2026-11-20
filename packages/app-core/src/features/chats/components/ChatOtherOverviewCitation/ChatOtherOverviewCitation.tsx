import type { OtherOverviewCitation, OverviewPart } from "@overview/domain";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { Routes } from "../../../../app/Routes.js";
import styles from "./ChatOtherOverviewCitation.module.scss";
import { chatOtherOverviewCitationTestIds } from "./ChatOtherOverviewCitationTestIds.js";

export interface ChatOtherOverviewCitationProps {
  citation: OtherOverviewCitation;
  held: boolean;
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

const otherOverviewCitationLabel = ({ title, item }: OtherOverviewCitation): string => {
  if (item === null) return title;
  const numbered = NUMBERED[item.part];
  return `${title} · ${numbered === undefined ? SECTION[item.part] : `${numbered} ${item.index + 1}`}`;
};

// Another of the reader's overviews an answer drew on (OV-355), named by the title it had when
// cited, as a link to it; muted, and not a link, once it is deleted. OV-354 designs it properly.
export function ChatOtherOverviewCitation({ citation, held, onFollowed }: ChatOtherOverviewCitationProps) {
  if (!held) {
    return (
      <span className={styles.gone} data-testid={chatOtherOverviewCitationTestIds.gone}>
        <StrokeIcon name="fileX" size={14} />
        {citation.title} · an overview you deleted
      </span>
    );
  }
  const label = otherOverviewCitationLabel(citation);
  return (
    <PageLink
      to={Routes.overview(citation.overviewId)}
      className={styles.pill}
      aria-label={`Open your overview ${label}`}
      onClick={() => onFollowed(citation)}
      data-testid={chatOtherOverviewCitationTestIds.link}
    >
      <StrokeIcon name="fileText" size={14} />
      <span className={styles.label}>{label}</span>
    </PageLink>
  );
}
