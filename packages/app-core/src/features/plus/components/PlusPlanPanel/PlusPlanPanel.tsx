import { PLAN_LABEL } from "../../planLabel.js";
import { EVERY_ACCOUNT_INCLUDES, PLAN_CARDS, UNSET_ALLOWANCE } from "../../planCards.js";
import { usePlan } from "../../usePlan.js";
import styles from "./PlusPlanPanel.module.scss";
import { plusPlanPanelTestIds } from "./PlusPlanPanelTestIds.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";

// Design 16c, redrawn by 95d–95h: the plan's name, what every account includes, then every
// plan as a card carrying both quotas, with the reader's own ringed and named. The usage
// those frames put above this waits for the server to count overviews.
export function PlusPlanPanel() {
  const { plan, status, recheck } = usePlan();
  const analytics = useAnalytics();

  if (status !== "known") {
    return (
      <section className={styles.root} aria-busy={status === "checking"} data-testid={plusPlanPanelTestIds.root}>
        <p className={styles.eyebrow}>Plan</p>
        <p className={styles.planName} data-testid={plusPlanPanelTestIds.planName}>
          {status === "checking" ? "Checking…" : "Couldn't check your plan"}
        </p>
        {status === "unreachable" && (
          <p className={styles.note}>
            Your plan is kept with your account, and the server didn't answer.{" "}
            <button
              type="button"
              className={styles.recheck}
              onClick={() => {
                analytics.plus.planPanel.recheckChosen();
                recheck();
              }}
              data-testid={plusPlanPanelTestIds.recheckButton}
            >
              Try again
            </button>
          </p>
        )}
      </section>
    );
  }

  const planName = PLAN_LABEL[plan];

  return (
    <section className={styles.root} data-testid={plusPlanPanelTestIds.root}>
      <p className={styles.eyebrow}>Plan</p>
      <p className={styles.planName} data-testid={plusPlanPanelTestIds.planName}>
        {planName}
      </p>

      <p className={styles.note} data-testid={plusPlanPanelTestIds.includedNote}>
        Every account gets all of it:
      </p>
      <ul className={styles.features}>
        {EVERY_ACCOUNT_INCLUDES.map((text) => (
          <li key={text} data-testid={plusPlanPanelTestIds.feature}>
            {text}
          </li>
        ))}
      </ul>

      <p className={styles.note}>What a plan buys is how many overviews you can make.</p>
      <ul className={styles.plans}>
        {PLAN_CARDS.map((card) => {
          const yours = card.name === planName;
          return (
            <li
              className={`${styles.plan} ${yours ? styles.yours : ""}`}
              key={card.name}
              data-testid={plusPlanPanelTestIds.planCard}
            >
              <div className={styles.planHead}>
                <span className={styles.planCardName}>{card.name}</span>
                {yours && <span className={styles.yoursPill}>Your plan</span>}
              </div>
              <dl className={styles.allowances}>
                <div>
                  <dt>On us</dt>
                  <dd>{card.ourKey ?? UNSET_ALLOWANCE}</dd>
                </div>
                <div>
                  <dt>On your own key</dt>
                  <dd>{card.ownKey}</dd>
                </div>
              </dl>
              <p className={styles.planNote}>{card.note}</p>
            </li>
          );
        })}
      </ul>

      <p className={styles.note} data-testid={plusPlanPanelTestIds.notOnSaleNote}>
        {planName === "Free"
          ? "Both paid plans need a way to pay for them, and that isn't built yet. There is nothing to buy here today — everything on this page works without it."
          : "This plan was set by hand: billing isn't built yet."}
      </p>
    </section>
  );
}
