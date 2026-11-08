import { overviewMetaParts, sourceName } from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { useSync } from "../../../sync/SyncContext.js";
import { useSyncConnection } from "../../../sync/useSyncConnection.js";
import { OverviewThumbnail } from "../../../../components/shared/OverviewThumbnail/OverviewThumbnail.js";
import type { LibraryEntry } from "../../../overviews/types/LibraryEntry.js";
import { readableEntries } from "../../../overviews/types/LibraryEntry.js";
import { orderLibraryEntriesBySavedAt } from "../../../overviews/util/orderLibraryEntriesBySavedAt.js";
import styles from "./RecentOverviews.module.scss";
import { recentOverviewsTestIds } from "./RecentOverviewsTestIds.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";

export interface RecentOverviewsProps {
  entries: LibraryEntry[];
}

const SHOWN = 3;

// Design 77aa: on a page there's nothing to take from, the panel offers what's already made.
// Design 205f-2 ends it with the way to the whole library, which is the web app's: the panel
// is one video, not a list (docs/features/extension-panel.md).
export function RecentOverviews({ entries }: RecentOverviewsProps) {
  const recent = readableEntries(orderLibraryEntriesBySavedAt(entries)).slice(0, SHOWN);
  const sync = useSync();
  const { connection } = useSyncConnection();
  const library = sync.connected && connection.apiUrl !== null ? new URL(Routes.home(), connection.apiUrl).href : null;
  if (recent.length === 0) return null;

  return (
    <section className={styles.root} aria-labelledby="recent-overviews" data-testid={recentOverviewsTestIds.root}>
      <h3 className={styles.heading} id="recent-overviews" data-testid={recentOverviewsTestIds.heading}>
        Recent
      </h3>
      {recent.map(({ overview }) => (
        <PageLink key={overview.id} className={styles.row} to={Routes.overview(overview.id)} data-testid={recentOverviewsTestIds.row}>
          <span className={styles.thumbnail}>
            <OverviewThumbnail video={overview.source} />
          </span>
          <span className={styles.body}>
            <span className={styles.title}>{overview.source.title}</span>
            <span className={styles.site}>{sourceName(overview.source)}</span>
            <span className={styles.facts}>{overviewMetaParts(overview).join(" · ")}</span>
          </span>
        </PageLink>
      ))}
      {library !== null && (
        <p className={styles.all} data-testid={recentOverviewsTestIds.webApp}>
          To see your full library,{" "}
          <a href={library} target="_blank" rel="noopener">
            open the web app
          </a>
        </p>
      )}
    </section>
  );
}
