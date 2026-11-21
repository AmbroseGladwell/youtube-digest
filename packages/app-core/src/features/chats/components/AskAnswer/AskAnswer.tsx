import type { ReactNode } from "react";
import type { ChatAnswerSections, ChatCitation, ChatScopeStats, OtherOverviewCitation } from "@overview/domain";
import { askStatsLine } from "../../util/askStatsLine.js";
import { citationKey } from "../../util/chatSourceGroups.js";
import { ChatAnswerSectionsView, ChatSourcesMenu } from "../ChatAnswer/ChatAnswer.js";
import { ChatOtherOverviewCitation } from "../ChatOtherOverviewCitation/ChatOtherOverviewCitation.js";
import styles from "./AskAnswer.module.scss";
import { askAnswerTestIds } from "./AskAnswerTestIds.js";

export interface AskAnswerProps {
  text: string;
  sections: ChatAnswerSections | undefined;
  citations: readonly ChatCitation[];
  stats: ChatScopeStats | undefined;
  scope: "library" | "project";
  arrived?: boolean;
  holds: (overviewId: string) => boolean;
  imageOf: (overviewId: string) => { url: string | null; wide: boolean };
  onFollowed: (citation: OtherOverviewCitation) => void;
  onSourcesOpened: (count: number) => void;
  actions: (sources: ReactNode) => ReactNode;
}

const paragraphsOf = (text: string) => text.split(/\n+/).filter((paragraph) => paragraph.trim() !== "");

const othersOf = (cited: readonly ChatCitation[]) => cited.flatMap((citation) => ("overviewId" in citation ? [citation] : []));

// OV-354, page 4: an answer over the library or a project, the same shape as every chat's: its
// intro, its sections each with their sources by relation, the Takeaway, then the line counted by
// code, never written by the model, and Copy with Sources.
export function AskAnswer({
  text,
  sections,
  citations,
  stats,
  scope,
  arrived = false,
  holds,
  imageOf,
  onFollowed,
  onSourcesOpened,
  actions,
}: AskAnswerProps) {
  const chipsOf = (cited: readonly ChatCitation[]): ReactNode[] =>
    othersOf(cited).map((citation, index) => {
      const image = imageOf(citation.overviewId);
      return (
        <ChatOtherOverviewCitation
          key={`${citationKey(citation)}-${index}`}
          citation={citation}
          held={holds(citation.overviewId)}
          imageUrl={image.url}
          wide={image.wide}
          onFollowed={onFollowed}
        />
      );
    });
  const listed = othersOf(citations).filter(
    (citation, index, all) => all.findIndex((each) => citationKey(each) === citationKey(citation)) === index,
  );
  const sourcesMenu =
    listed.length === 0 ? null : (
      <ChatSourcesMenu count={listed.length} onOpened={onSourcesOpened}>
        {chipsOf(listed)}
      </ChatSourcesMenu>
    );
  return (
    <div className={`${styles.root} ${arrived ? styles.arrived : ""}`} data-testid={askAnswerTestIds.root}>
      <div className={styles.text}>
        {sections === undefined ? (
          paragraphsOf(text).map((paragraph, index) => <p key={index}>{paragraph}</p>)
        ) : (
          <ChatAnswerSectionsView sections={sections} chipsOf={chipsOf} />
        )}
      </div>
      {stats !== undefined && (
        <p className={styles.stats} data-testid={askAnswerTestIds.stats}>
          {askStatsLine(stats, scope)}
        </p>
      )}
      {actions(sourcesMenu)}
    </div>
  );
}
