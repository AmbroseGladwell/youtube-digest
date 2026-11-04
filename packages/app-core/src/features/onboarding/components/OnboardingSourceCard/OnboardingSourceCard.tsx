import { OverviewThumbnail } from "../../../../components/shared/OverviewThumbnail/OverviewThumbnail.js";
import type { OnboardingCard, OnboardingFound, OnboardingSource } from "../../onboardingSources.js";
import styles from "./OnboardingSourceCard.module.scss";
import { onboardingSourceCardTestIds } from "./OnboardingSourceCardTestIds.js";

export interface OnboardingSourceCardProps {
  kind: OnboardingSource;
  found: OnboardingFound;
  // Large on the confirm screen; compact in the panel, with the image beside the title and the
  // facts under both; small in the preview and a playlist's row, with facts only where there's
  // no kicker.
  size?: "large" | "compact" | "small";
}

// One card for every kind (154d–154h): the image, or the site's name on a stone tile, then a
// kicker naming the source and its kind, the title, and facts that belong to the kind.
export function OnboardingSourceCard({ kind, found, size = "large" }: OnboardingSourceCardProps) {
  const { kicker, facts } = kind.card(found);
  const factsBeside = size === "large" || kicker === null;
  return (
    <div className={styles[size]} data-testid={onboardingSourceCardTestIds.root}>
      <span className={styles.head}>
        <OverviewThumbnail video={found.source} className={styles.thumb} />
        <span className={styles.meta}>
          {kicker !== null && (
            <span className={styles.kicker} data-testid={onboardingSourceCardTestIds.kicker}>
              {kicker}
            </span>
          )}
          <span className={styles.title} data-testid={onboardingSourceCardTestIds.title}>
            {found.source.title}
          </span>
          {factsBeside && <Facts facts={facts} />}
        </span>
      </span>
      {size === "compact" && !factsBeside && <Facts facts={facts} />}
    </div>
  );
}

function Facts({ facts }: { facts: OnboardingCard["facts"] }) {
  if ("line" in facts) {
    return facts.line === "" ? null : (
      <span className={styles.line} data-testid={onboardingSourceCardTestIds.facts}>
        {facts.line}
      </span>
    );
  }
  return (
    <dl className={styles.figures} data-testid={onboardingSourceCardTestIds.facts}>
      {facts.figures.map(({ label, value }) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
