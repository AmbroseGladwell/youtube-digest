import { useEffect, useRef } from "react";
import type { Plan } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
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

// Design 327ah: one modal for every way to the plans: the wall's Get Plus and See every plan, and
// the nudge's See plans. Every plan has every feature, so the cards differ only in their figures.
// Choosing a paid plan goes to checkout once billing exists (OV-18); until then the buttons say so
// rather than going nowhere. On a phone Plus comes first, so the recommended plan is in view.
export const PlansModal = ({ open, plan, onClose }: PlansModalProps) => {
  const dialog = useRef<HTMLDialogElement | null>(null);
  const phone = useIsPhone();
  useEffect(() => {
    const element = dialog.current;
    if (element === null) {
      return;
    }
    if (open && !element.open) {
      element.showModal();
    }
    if (!open && element.open) {
      element.close();
    }
  }, [open]);
  const cards = phone ? [...PLAN_CARDS].reverse() : PLAN_CARDS;

  return (
    <dialog ref={dialog} className={styles.root} aria-labelledby="plans-modal-title" onClose={onClose} data-testid={plansModalTestIds.root}>
      <div className={styles.head}>
        <h2 id="plans-modal-title" className={styles.title}>
          Plans.
        </h2>
        <button type="button" className={styles.close} aria-label="Close" onClick={onClose} data-testid={plansModalTestIds.close}>
          <StrokeIcon name="close" size={18} />
        </button>
      </div>
      <p className={styles.lead}>Every plan has every feature. They differ in how much you can make and ask a month.</p>
      <ul className={styles.cards}>
        {cards.map((card) => (
          <PlanCardItem key={card.name} card={card} yours={PLAN_OF_CARD[card.name] === plan} />
        ))}
      </ul>
      <p className={styles.foot}>Cancel anytime. Prices in GBP.</p>
    </dialog>
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
