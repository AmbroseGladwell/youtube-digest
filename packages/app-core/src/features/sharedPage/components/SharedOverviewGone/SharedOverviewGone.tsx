import { Link } from "react-router";
import { Routes } from "../../../../app/Routes.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import styles from "./SharedOverviewGone.module.scss";
import { sharedOverviewGoneTestIds } from "./SharedOverviewGoneTestIds.js";

export interface SharedOverviewGoneProps {
  state: "revoked" | "unknown";
}

// Design 30g. The page says what happened and nothing about what was there: not the title,
// not the verdict, not who shared it (docs/features/sharing.md).
const COPY = {
  revoked: {
    heading: "This overview is no longer shared",
    body: "The person who shared it has turned the link off.",
  },
  unknown: {
    heading: "This link doesn’t go anywhere",
    body: "Check the link you were sent, or ask for it again.",
  },
} as const;

export function SharedOverviewGone({ state }: SharedOverviewGoneProps) {
  const { heading, body } = COPY[state];
  const analytics = useAnalytics();

  return (
    <main className={styles.root} data-testid={sharedOverviewGoneTestIds.root}>
      <span className={styles.rule} aria-hidden="true" />
      <h1 className={styles.heading} data-testid={sharedOverviewGoneTestIds.heading}>
        {heading}
      </h1>
      <p className={styles.body} data-testid={sharedOverviewGoneTestIds.body}>
        {body}
      </p>
      <div>
        <Link
          className={styles.action}
          to={Routes.createAccount()}
          onClick={() => analytics.sharedPage.gone.makeChosen()}
          data-testid={sharedOverviewGoneTestIds.makeButton}
        >
          Make an overview of your own
        </Link>
      </div>
    </main>
  );
}
