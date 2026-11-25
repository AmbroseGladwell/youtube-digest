import type { Plan } from "@overview/domain";
import { BottomSheet } from "../../../../components/shared/BottomSheet/BottomSheet.js";
import { useIsPhone } from "../../../../util/useIsPhone.js";
import { PLAN_CARDS, type PlanCard } from "../../planCards.js";
import styles from "./PlansModal.module.scss";
import { plansModalTestIds } from "./PlansModalTestIds.js";

const PLAN_OF_CARD: Record<string, Plan> = { Free: "free", "BYO Plus": "byo-plus", Plus: "plus" };
const CHOOSE: Record<Plan, string> = { free: "", "byo-plus": "Choose BYO Plus", plus: "Get Plus" };

export interface PlansModalProps {
  open: boolean;
  plan: Plan;
  onClose: () => void;
}

// On a phone Plus comes first, so the recommended plan is in view (design 327ah).
export const PlansModal = ({ open, plan, onClose }: PlansModalProps) => {
  const phone = useIsPhone();
  const cards = phone ? [...PLAN_CARDS].reverse() : PLAN_CARDS;

  return (
    <BottomSheet
      open={open}
      title="Plans."
      onClose={onClose}
      wide="dialog"
      width="60rem"
      testId={plansModalTestIds.root}
      head={<h2 className={styles.title}>Plans.</h2>}
    >
      <div className={styles.content}>
        <p className={styles.lead}>Every plan has every feature. They differ in how much you can make and ask a month.</p>
        <ul className={styles.cards}>
          {cards.map((card) => (
            <PlanCardItem key={card.name} card={card} yours={PLAN_OF_CARD[card.name] === plan} />
          ))}
        </ul>
        <p className={styles.foot}>Cancel anytime. Prices in GBP.</p>
      </div>
    </BottomSheet>
  );
};

interface PlanCardItemProps {
  card: PlanCard;
  yours: boolean;
}

const PlanCardItem = ({ card, yours }: PlanCardItemProps) => {
  const plan = PLAN_OF_CARD[card.name]!;
  const recommended = plan === "plus";
  return (
    <li className={`${styles.card} ${yours ? styles.yours : ""}`} data-testid={plansModalTestIds.card(plan)}>
      <div className={styles.cardHead}>
        <span className={styles.name}>{card.name}</span>
        {yours && <span className={styles.tag}>Your plan</span>}
        {!yours && recommended && <span className={styles.tag}>Recommended</span>}
      </div>
      <span className={styles.price}>{card.price}</span>
      <dl className={styles.figures}>
        <div>
          <dt>On us</dt>
          <dd>{card.ourKey}</dd>
        </div>
        <div>
          <dt>On your own AI API key</dt>
          <dd>{card.ownKey}</dd>
        </div>
        <div>
          <dt>Chat, on us</dt>
          <dd>{card.chat}</dd>
        </div>
        <div>
          <dt>Transcribing episodes</dt>
          <dd>{card.transcribing}</dd>
        </div>
      </dl>
      <p className={styles.note}>{card.note}</p>
      {yours ? (
        <span className={styles.current}>What you’re on now</span>
      ) : (
        plan !== "free" && (
          <>
            <button
              type="button"
              className={recommended ? styles.primary : styles.secondary}
              disabled
              aria-describedby={`plans-modal-billing-${plan}`}
              data-testid={plansModalTestIds.choose(plan)}
            >
              {CHOOSE[plan]}
            </button>
            <span id={`plans-modal-billing-${plan}`} className={styles.soon}>
              Paying for a plan opens soon.
            </span>
          </>
        )
      )}
    </li>
  );
};
