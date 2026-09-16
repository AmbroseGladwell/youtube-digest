import { useState } from "react";
import type { Overview, OverviewId } from "@overview/types";
import { GenerateOverviewForm } from "../../newOverview/components/GenerateOverviewForm/GenerateOverviewForm.js";
import { useOverviewsWithStateQuery } from "../../overviews/queries/overviewsWithStateQuery.js";
import { LibraryPage } from "../../library/LibraryPage/LibraryPage.js";
import styles from "./HomePage.module.scss";
import { homePageTestIds } from "./HomePageTestIds.js";

export function HomePage() {
  const overviewsQuery = useOverviewsWithStateQuery();
  const [justGeneratedId, setJustGeneratedId] = useState<OverviewId | null>(null);

  const handleGenerated = (overview: Overview) => {
    setJustGeneratedId(overview.id);
  };

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
        <GenerateOverviewForm variant="hero" onGenerated={handleGenerated} />
      </div>
    );
  }

  return (
    <div className={styles.root} data-testid={homePageTestIds.root}>
      <LibraryPage
        overviewsWithState={overviewsQuery.data}
        justGeneratedId={justGeneratedId}
        onGenerated={handleGenerated}
      />
    </div>
  );
}
