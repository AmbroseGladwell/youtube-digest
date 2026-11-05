import type { AuthIntent, Overview } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { OnboardingHeading } from "../OnboardingHeading/OnboardingHeading.js";
import { OnboardingTeaser } from "../OnboardingTeaser/OnboardingTeaser.js";
import styles from "./OnboardingAccount.module.scss";
import { onboardingAccountTestIds } from "./OnboardingAccountTestIds.js";

export interface OnboardingAccountProps {
  overview: Overview | null;
  // On a wide screen the teaser sits in the preview beside the screens instead (154k).
  teaserBeside: boolean;
  sample: boolean;
  failed: boolean;
  onTryAgain: () => void;
  onChoose: (way: AuthIntent) => void;
}

// Design 46j: what's ready, then the way to it. The teaser carries the title and the Premise
// and nothing more: the rest is drawn, not the overview's text, so none of it can be read
// before there is an account. There's no way past without one, and no waiting for the
// overview either: a reader who gets here first makes the account now, and it arrives there.
// Email only for now (docs/features/onboarding.md, "The account").
export function OnboardingAccount({ overview, teaserBeside, sample, failed, onTryAgain, onChoose }: OnboardingAccountProps) {
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
          Your overview is still being written. It'll be ready in your account.
        </p>
      ) : teaserBeside ? null : (
        <OnboardingTeaser overview={overview} sample={sample} />
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
        onClick={() => onChoose("signIn")}
        data-testid={onboardingAccountTestIds.signIn}
      >
        Already have an account? Sign in
      </button>
    </div>
  );
}
