import { Link } from "react-router";
import { Routes } from "../../../app/Routes.js";
import { hasRequiredApiKeys } from "../../apiKeys/ApiKeys.js";
import { useApiKeys } from "../../apiKeys/useApiKeys.js";
import { useOverviewsWithStateQuery } from "../../overviews/queries/overviewsWithStateQuery.js";
import { LibraryPage } from "../../library/LibraryPage/LibraryPage.js";
import styles from "./HomePage.module.scss";
import { homePageTestIds } from "./HomePageTestIds.js";

export function HomePage() {
  const overviewsQuery = useOverviewsWithStateQuery();
  const { apiKeys } = useApiKeys();

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
        <p className={styles.error} data-testid={homePageTestIds.error}>
          Couldn't load your library: {overviewsQuery.error.message}
        </p>
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
            Hit <em className={styles.heroEm}>+ New</em> in the bar above and paste a YouTube
            URL. Get a succinct overview, with the main premise, key points, actionable steps
            and a verdict on if it's worth your time.
          </p>
          {!hasRequiredApiKeys(apiKeys) && (
            <p className={styles.heroKeys}>
              Generation is bring-your-own-key, and both keys stay on this device.{" "}
              <Link to={Routes.settings()} data-testid={homePageTestIds.settingsLink}>
                Add your keys in Settings →
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
