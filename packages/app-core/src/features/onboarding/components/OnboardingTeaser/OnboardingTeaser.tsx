import type { Overview } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { onboardingSources } from "../../onboardingSources.js";
import styles from "./OnboardingTeaser.module.scss";
import { onboardingTeaserTestIds } from "./OnboardingTeaserTestIds.js";

// Designs 46j and 154j: what's ready, and no more of it than its first section. The rest is
// drawn, not the overview's text, so none of it can be read before there is an account; the
// last line names what an account opens for this kind. Beside the screens it's already in the
// preview's card (154k).
// A sample says so here, where it changes what counts (155h).
export function OnboardingTeaser({ overview, sample = false, beside = false }: { overview: Overview; sample?: boolean; beside?: boolean }) {
  const { byline, first, locked } = onboardingSources[overview.source.kind].teaser(overview);
  return (
    <section
      className={beside ? `${styles.root} ${styles.beside}` : styles.root}
      aria-label="Your overview, so far"
      data-testid={onboardingTeaserTestIds.root}
    >
      <span className={styles.ready}>
        <StrokeIcon name="check" size={13} />
        {sample ? "Your sample overview is ready" : "Your overview is ready"}
      </span>
      <h2 className={styles.title} data-testid={onboardingTeaserTestIds.title}>
        {overview.source.title}
      </h2>
      <p className={styles.byline} data-testid={onboardingTeaserTestIds.byline}>
        {byline}
      </p>
      <p className={styles.label}>{first.label}</p>
      <p className={styles.first} data-testid={onboardingTeaserTestIds.first}>
        {first.text}
      </p>
      <span className={styles.fade} aria-hidden="true">
        <span style={{ width: "100%" }} />
        <span style={{ width: "92%" }} />
        <span style={{ width: "96%" }} />
        <span style={{ width: "70%" }} />
      </span>
      <p className={styles.locked} data-testid={onboardingTeaserTestIds.locked}>
        {locked}
      </p>
    </section>
  );
}
