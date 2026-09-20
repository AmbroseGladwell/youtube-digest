import { PLAN_LABEL } from "../../planLabel.js";
import { PLUS_FEATURES } from "../../plusFeatures.js";
import { usePlan } from "../../usePlan.js";
import styles from "./PlusPlanPanel.module.scss";
import { plusPlanPanelTestIds } from "./PlusPlanPanelTestIds.js";

export function PlusPlanPanel() {
  const { plan, isPlus } = usePlan();

  return (
    <section className={styles.root} data-testid={plusPlanPanelTestIds.root}>
      <p className={styles.eyebrow}>Plan</p>
      <p className={styles.planName} data-testid={plusPlanPanelTestIds.planName}>
        {PLAN_LABEL[plan]}
      </p>

      {isPlus ? (
        <>
          <ul className={styles.features}>
            {PLUS_FEATURES.map((feature) => (
              <li key={feature} data-testid={plusPlanPanelTestIds.feature}>
                {feature}
              </li>
            ))}
          </ul>
          <p className={styles.note} data-testid={plusPlanPanelTestIds.includedNote}>
            Both are included on this plan.
          </p>
        </>
      ) : (
        <div className={styles.offer} data-testid={plusPlanPanelTestIds.offer}>
          <p className={styles.offerName}>Plus</p>
          <ul className={styles.features}>
            {PLUS_FEATURES.map((feature) => (
              <li key={feature} data-testid={plusPlanPanelTestIds.feature}>
                {feature}
              </li>
            ))}
          </ul>
          <p className={styles.note} data-testid={plusPlanPanelTestIds.notOnSaleNote}>
            Plus needs an account and a way to pay for it, and neither is built yet. There is
            nothing to buy here today — everything on this page works without one.
          </p>
        </div>
      )}
    </section>
  );
}
