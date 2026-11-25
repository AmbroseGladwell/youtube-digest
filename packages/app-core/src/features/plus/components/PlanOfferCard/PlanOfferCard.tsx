import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { PAID_PRICES, PLAN_OFFERS, type Billing, type PaidPlan } from "../../planCards.js";
import type { Plan } from "@overview/domain";
import styles from "./PlanOfferCard.module.scss";
import { planOfferCardTestIds } from "./PlanOfferCardTestIds.js";

export interface PlanOfferCardProps {
  plan: Plan;
  billing: Billing;
  yours: boolean;
  told: boolean;
  onTell: (plan: PaidPlan) => void;
}

// One plan, every benefit it gives (design 351j); Tell me when stands in for paying until billing.
export const PlanOfferCard = ({ plan, billing, yours, told, onTell }: PlanOfferCardProps) => {
  const offer = PLAN_OFFERS[plan];
  const recommended = plan === "plus";
  return (
    <li className={`${styles.card} ${yours ? styles.yours : ""}`} data-testid={planOfferCardTestIds.card(plan)}>
      <span className={styles.top}>
        <span className={styles.name}>{offer.name}</span>
        <span className={styles.tags}>
          {yours && <span className={styles.tag}>Your plan</span>}
          {!yours && recommended && <span className={`${styles.tag} ${styles.recommended}`}>Recommended</span>}
          {plan !== "free" && <span className={`${styles.tag} ${recommended ? styles.outlined : ""}`}>Coming soon</span>}
        </span>
      </span>
      {plan === "free" ? <span className={styles.price}>£0</span> : <PaidPriceLines plan={plan} billing={billing} />}
      <span className={styles.tagline}>{offer.tagline}</span>
      {offer.includes !== null && <p className={styles.includes}>{offer.includes}</p>}
      <ul className={styles.benefits}>
        {offer.benefits.map((benefit) => (
          <li key={benefit}>
            <StrokeIcon name="check" size={13} />
            <span>{benefit}</span>
          </li>
        ))}
      </ul>
      {plan !== "free" && !yours && (
        <button
          type="button"
          className={recommended ? styles.primary : styles.secondary}
          aria-disabled={told}
          onClick={() => {
            if (!told) {
              onTell(plan);
            }
          }}
          data-testid={planOfferCardTestIds.tellMeWhen(plan)}
        >
          {told ? (
            <>
              <StrokeIcon name="check" size={15} />
              On the list
            </>
          ) : (
            "Tell me when"
          )}
        </button>
      )}
    </li>
  );
};

interface PaidPriceLinesProps {
  plan: PaidPlan;
  billing: Billing;
}

const PaidPriceLines = ({ plan, billing }: PaidPriceLinesProps) => {
  const price = PAID_PRICES[plan];
  if (billing === "monthly") {
    return (
      <span className={styles.price}>
        {price.monthly}
        <small> a month</small>
      </span>
    );
  }
  return (
    <>
      <span className={styles.price}>
        {price.yearlyPerMonth}
        <small> a month</small>
      </span>
      <span className={styles.billed}>
        Billed yearly at {price.billedYearly} · save {price.saves}
      </span>
    </>
  );
};
