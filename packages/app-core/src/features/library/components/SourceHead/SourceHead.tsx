import { useLentBackLink } from "../../../../app/useLentBackLink.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import type { OverviewWithState } from "../../../overviews/types/OverviewWithState.js";
import { projectShortDate } from "../../../projects/util/projectDates.js";
import type { LibraryViewLink } from "../../useLibraryViewLink.js";
import type { LibrarySource } from "../../util/librarySourceOf.js";
import { SourceTile } from "../SourceTile/SourceTile.js";
import styles from "./SourceHead.module.scss";
import { sourceHeadTestIds } from "./SourceHeadTestIds.js";

export interface SourceHeadProps {
  source: LibrarySource;
  overviews: OverviewWithState[];
  back: LibraryViewLink;
  isPhone: boolean;
  now: Date;
  onLeave: () => void;
  onSiteOpened: () => void;
}

const BACK_LABEL = "All overviews";

const factsLine = (overviews: OverviewWithState[], now: Date): string => {
  const unread = overviews.filter(({ state }) => !state.read).length;
  const latest = overviews.reduce<string | null>(
    (newest, { overview }) => (newest === null || overview.savedAt > newest ? overview.savedAt : newest),
    null,
  );
  const counted = `${overviews.length} ${overviews.length === 1 ? "overview" : "overviews"} · ${unread} unread`;
  return latest === null ? counted : `${counted} · latest saved ${projectShortDate(latest, now)}`;
};

// Design 399q: one source chosen shows its page, built like a project's: docs/features/navigation.md, "A source's page".
export const SourceHead = ({ source, overviews, back, isPhone, now, onLeave, onSiteOpened }: SourceHeadProps) => {
  const follow = () => {
    onLeave();
    back.follow();
  };
  const backLink = useLentBackLink({ to: back.to, label: BACK_LABEL, follow });

  return (
    <div className={styles.root} data-testid={sourceHeadTestIds.root}>
      <PageLink ref={backLink} className={styles.back} to={back.to} onClick={follow} data-testid={sourceHeadTestIds.backLink}>
        <StrokeIcon name="arrowLeft" size={15} />
        {BACK_LABEL}
      </PageLink>
      <p className={styles.kicker}>
        Source
        {source.domain !== null && (
          <>
            <span aria-hidden="true">·</span>
            <a
              className={styles.site}
              href={`https://${source.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${source.domain}, opens the site`}
              onClick={onSiteOpened}
              data-testid={sourceHeadTestIds.siteLink}
            >
              {source.domain}
              <StrokeIcon name="openOut" size={13} />
            </a>
          </>
        )}
      </p>
      <div className={styles.name}>
        <SourceTile source={source} size={isPhone ? 44 : 52} />
        <h1 className={styles.title} data-testid={sourceHeadTestIds.title}>
          {source.name}
        </h1>
      </div>
      <p className={styles.facts} data-testid={sourceHeadTestIds.facts}>
        {factsLine(overviews, now)}
      </p>
    </div>
  );
};
