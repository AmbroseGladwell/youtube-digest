import { Link } from "react-router";
import { useIsPanel } from "../../../app/LayoutContext.js";
import { Routes } from "../../../app/Routes.js";
import { useSurface } from "../../../app/SurfaceContext.js";
import {
  settingsLinkLabel,
  transcriptSourceNote,
} from "../../transcripts/transcriptSourceNote.js";
import { useGenerationReadiness } from "../../newOverview/useGenerationReadiness.js";
import { useOverviewsWithStateQuery } from "../../overviews/queries/overviewsWithStateQuery.js";
import { ErrorState } from "../../../components/shared/ErrorState/ErrorState.js";
import { LibraryPage } from "../../library/LibraryPage/LibraryPage.js";
import { CapturePage } from "../../capture/CapturePage/CapturePage.js";
import styles from "./HomePage.module.scss";
import { homePageTestIds } from "./HomePageTestIds.js";

// Home is the library everywhere but the side panel, where it is the one video the
// panel is beside (docs/features/extension-panel.md).
export function HomePage() {
  return useIsPanel() ? <CapturePage /> : <LibraryHome />;
}

function LibraryHome() {
  const overviewsQuery = useOverviewsWithStateQuery();
  const readiness = useGenerationReadiness();
  const surface = useSurface();

  if (overviewsQuery.isPending) {
    return (
      <div className={styles.root} data-testid={homePageTestIds.root}>
        <div className={styles.skeleton} data-testid={homePageTestIds.skeleton}>
          <div className={styles.skeletonBar} style={{ width: "60%" }} />
          <div className={styles.skeletonBar} style={{ width: "100%" }} />
          <div className={styles.skeletonBar} style={{ width: "100%" }} />
        </div>
      </div>
    );
  }

  if (overviewsQuery.isError) {
    return (
      <div className={styles.root} data-testid={homePageTestIds.root}>
        <ErrorState
          title="Couldn't load your library"
          body="Something went wrong reading your saved overviews. Nothing has been lost."
          action={{ label: "Try again", onSelect: () => void overviewsQuery.refetch() }}
        />
      </div>
    );
  }

  if (overviewsQuery.data.length === 0) {
    return (
      <div className={styles.root} data-testid={homePageTestIds.root}>
        <div className={styles.hero} data-testid={homePageTestIds.hero}>
          <h2 className={styles.heroTitle}>
            Watch Less,
            <br />
            with <em className={styles.heroEm}>The Overview</em>
          </h2>
          <p className={styles.heroStandfirst}>
            Hit <em className={styles.heroEm}>+ New</em> in the bar above and paste a YouTube URL.
            Get a succinct overview, with the main premise, key points, actionable steps and a
            verdict on if it's worth your time.
          </p>
          {surface === "extension" && (
            <p className={styles.heroKeys} data-testid={homePageTestIds.separateLibraryNote}>
              This is the extension's own library, kept separate from the web app's by the browser
              itself.
            </p>
          )}
          {readiness !== "ready" && (
            <p className={styles.heroKeys}>
              {transcriptSourceNote(readiness)}{" "}
              <Link to={Routes.settings()} data-testid={homePageTestIds.settingsLink}>
                {settingsLinkLabel(readiness)}
              </Link>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wide} data-testid={homePageTestIds.root}>
      <LibraryPage overviewsWithState={overviewsQuery.data} />
    </div>
  );
}
