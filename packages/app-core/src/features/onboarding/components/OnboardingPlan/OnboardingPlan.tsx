import type { ReactNode } from "react";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { OnboardingHeading } from "../OnboardingHeading/OnboardingHeading.js";
import styles from "./OnboardingPlan.module.scss";
import { onboardingPlanTestIds } from "./OnboardingPlanTestIds.js";

export interface OnboardingPlanProps {
  // The overview is written; still being written, the lead says it's on its way.
  made: boolean;
  // A sample isn't counted, so the plan says the first overview they make will be (155i).
  sample: boolean;
  onFree: () => void;
}

// Design 46k: Free and Plus as the same card with the same button, volume the only difference.
// Plus can't be bought until there is billing, so its button says so and Free goes on to the
// reveal, or to Nearly there until the overview is in the account; the plan never waits on
// it. The first overview counts as one of the plan's on us
// (docs/architecture/tiers.md, "Counting"; docs/features/onboarding.md, "The plan").
export function OnboardingPlan({ made, sample, onFree }: OnboardingPlanProps) {
  return (
    <div className={styles.root} data-testid={onboardingPlanTestIds.root}>
      <div className={styles.intro}>
        <OnboardingHeading>Choose your plan</OnboardingHeading>
        <p className={styles.lead}>
          {sample ? "Your sample overview is ready." : made ? "Your overview is ready." : "Your overview is on its way."} Pick how you'd
          like to keep going.
        </p>
      </div>
      <p className={styles.includes}>Every plan includes your library, topics and AI connection.</p>

      <div className={styles.cards}>
        <PlanCard name="Free" price="Free" onUs="5 overviews a month on us" ownKey="10 more with your own key">
          <button
            type="button"
            className={styles.choose}
            onClick={onFree}
            data-testid={onboardingPlanTestIds.continueWithFree}
          >
            Continue with Free
          </button>
        </PlanCard>
        <PlanCard name="Plus" price="£7.99 a month" onUs="50 overviews a month on us" ownKey="200 more with your own key" recommended>
          <button type="button" className={styles.choose} disabled data-testid={onboardingPlanTestIds.startPlus}>
            Coming soon
          </button>
        </PlanCard>
      </div>

      <div className={styles.under}>
        <p className={styles.byo}>Have your own AI key? Plus for £4.99 a month is coming soon too.</p>
        <p className={styles.counts} data-testid={onboardingPlanTestIds.counts}>
          {sample
            ? "This sample doesn't count towards your month. The first overview you make will."
            : "This overview counts as your first of the month."}
        </p>
      </div>
    </div>
  );
}

interface PlanCardProps {
  name: string;
  price: string;
  onUs: string;
  ownKey: string;
  recommended?: boolean;
  children: ReactNode;
}

function PlanCard({ name, price, onUs, ownKey, recommended = false, children }: PlanCardProps) {
  return (
    <div className={styles.card}>
      <span className={styles.cardHead}>
        <span className={styles.name}>{name}</span>
        {recommended && <span className={styles.recommended}>Recommended</span>}
      </span>
      <span className={styles.price}>{price}</span>
      <ul className={styles.gives}>
        <li>
          <span className={styles.tick}>
            <StrokeIcon name="check" size={14} />
          </span>
          {onUs}
        </li>
        <li className={styles.more}>
          <span>
            <StrokeIcon name="plus" size={14} />
          </span>
          {ownKey}
        </li>
      </ul>
      <span className={styles.action}>{children}</span>
    </div>
  );
}
