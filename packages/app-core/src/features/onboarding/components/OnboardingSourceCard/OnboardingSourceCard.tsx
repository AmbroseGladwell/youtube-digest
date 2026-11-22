import { OverviewThumbnail } from "../../../../components/shared/OverviewThumbnail/OverviewThumbnail.js";
import type { OnboardingCard, OnboardingFound, OnboardingSource } from "../../onboardingSources.js";
import styles from "./OnboardingSourceCard.module.scss";
import { onboardingSourceCardTestIds } from "./OnboardingSourceCardTestIds.js";

export interface OnboardingSourceCardProps {
  kind: OnboardingSource;
  found: OnboardingFound;
  // Row on Your link, compact in the panel, small in the preview and a playlist's row (327c).
  size?: "row" | "large" | "compact" | "small";
}

export const OnboardingSourceCard = ({ kind, found, size = "large" }: OnboardingSourceCardProps) => {
  const { kicker, facts } = kind.card(found);
  const factsBeside = size === "large" || size === "row" || kicker === null;
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
};

const Facts = ({ facts }: { facts: OnboardingCard["facts"] }) => {
  return facts.line === "" ? null : (
    <span className={styles.line} data-testid={onboardingSourceCardTestIds.facts}>
      {facts.line}
    </span>
  );
};
