import { formatClock, type AuthIntent, type Overview } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { OnboardingHeading } from "../OnboardingHeading/OnboardingHeading.js";
import styles from "./OnboardingAccount.module.scss";
import { onboardingAccountTestIds } from "./OnboardingAccountTestIds.js";

export interface OnboardingAccountProps {
  overview: Overview | null;
  failed: boolean;
  onTryAgain: () => void;
  onChoose: (way: AuthIntent) => void;
}

// Design 46j: what's ready, then the way to it. The teaser carries the title and the Premise
// and nothing more: the rest is drawn, not the overview's text, so none of it can be read
// before there is an account. There's no way past without one. Email only for now
// (docs/features/onboarding.md, "The account").
export function OnboardingAccount({ overview, failed, onTryAgain, onChoose }: OnboardingAccountProps) {
  return (
    <div className={styles.root} data-testid={onboardingAccountTestIds.root}>
      {failed ? (
        <div className={styles.failed} role="alert" data-testid={onboardingAccountTestIds.failed}>
          <span className={styles.failedIcon}>
            <StrokeIcon name="alert" size={16} />
          </span>
          <span className={styles.failedText}>Something went wrong making your overview.</span>
          <button type="button" className={styles.tryAgain} onClick={onTryAgain} data-testid={onboardingAccountTestIds.tryAgain}>
            <StrokeIcon name="refresh" size={14} />
            Try again
          </button>
        </div>
      ) : overview === null ? (
        <p className={styles.notReady} data-testid={onboardingAccountTestIds.notReady}>
          Your overview is still being made. You can create your account as soon as it's ready.
        </p>
      ) : (
        <Teaser overview={overview} />
      )}

      <div className={styles.intro}>
        <OnboardingHeading>Create your free account</OnboardingHeading>
        <p className={styles.lead}>
          Keep every overview in your library on any device, sort them into topics and ask your AI about anything you've
          kept.
        </p>
      </div>

      <div className={styles.ways}>
        <button
          type="button"
          className={styles.way}
          disabled={overview === null}
          onClick={() => onChoose("createAccount")}
          data-testid={onboardingAccountTestIds.continueWithEmail}
        >
          <StrokeIcon name="mail" size={17} />
          Continue with email
        </button>
      </div>
      <button
        type="button"
        className={styles.quiet}
        disabled={overview === null}
        onClick={() => onChoose("signIn")}
        data-testid={onboardingAccountTestIds.signIn}
      >
        Already have an account? Sign in
      </button>
    </div>
  );
}

function Teaser({ overview }: { overview: Overview }) {
  const { video } = overview;
  return (
    <section className={styles.teaser} aria-label="Your overview, so far" data-testid={onboardingAccountTestIds.teaser}>
      <span className={styles.ready}>
        <StrokeIcon name="check" size={13} />
        Your overview is ready
      </span>
      <h2 className={styles.teaserTitle} data-testid={onboardingAccountTestIds.teaserTitle}>
        {video.title}
      </h2>
      <p className={styles.byline}>
        {[video.channel, video.durationMs === null ? null : formatClock(video.durationMs / 1000)].filter(Boolean).join(" · ")}
      </p>
      <p className={styles.sectionLabel}>Premise</p>
      <p className={styles.premise} data-testid={onboardingAccountTestIds.teaserPremise}>
        {overview.inOneLine}
      </p>
      <span className={styles.fade} aria-hidden="true">
        <span style={{ width: "100%" }} />
        <span style={{ width: "92%" }} />
        <span style={{ width: "96%" }} />
        <span style={{ width: "70%" }} />
      </span>
      <p className={styles.opens}>Key points, How to apply and Verdict open with an account.</p>
    </section>
  );
}
