import { useState } from "react";
import { Link } from "react-router";
import type { OverviewId } from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { readNextSteps, writeNextSteps, type NextStep } from "../../nextStepsStorage.js";
import styles from "./OnboardingNextSteps.module.scss";
import { onboardingNextStepsTestIds } from "./OnboardingNextStepsTestIds.js";

// Design 46l: under the Verdict of onboarding's overview, the extension and the AI connection,
// each dismissible, and never a modal. Shown only on the overview onboarding ended on.
export function OnboardingNextSteps({ overviewId }: { overviewId: OverviewId }) {
  const analytics = useAnalytics();
  const [nextSteps, setNextSteps] = useState(readNextSteps);
  if (nextSteps === null || nextSteps.overviewId !== overviewId) return null;

  const shown = (step: NextStep) => !nextSteps.dismissed.includes(step);
  const dismiss = (step: NextStep) => {
    analytics.onboarding.nextSteps.dismissed({ step });
    const next = { ...nextSteps, dismissed: [...nextSteps.dismissed, step] };
    writeNextSteps(next);
    setNextSteps(next);
  };
  if (!shown("extension") && !shown("ai")) return null;

  return (
    <section className={styles.root} aria-label="Next steps" data-testid={onboardingNextStepsTestIds.root}>
      {shown("extension") && (
        <div className={styles.card} data-testid={onboardingNextStepsTestIds.card("extension")}>
          <DismissButton label="Save in one click." onDismiss={() => dismiss("extension")} step="extension" />
          <span className={styles.icon}>
            <StrokeIcon name="puzzle" size={20} />
          </span>
          <span className={styles.title}>Save in one click.</span>
          <p className={styles.body}>Add the Chrome extension and save straight from the page you're on.</p>
          <span>
            <button
              type="button"
              className={styles.action}
              disabled
              title="The extension isn't in the Web Store yet"
              data-testid={onboardingNextStepsTestIds.action("extension")}
            >
              Add to Chrome
            </button>
          </span>
        </div>
      )}
      {shown("ai") && (
        <div className={styles.card} data-testid={onboardingNextStepsTestIds.card("ai")}>
          <DismissButton label="Ask your AI about anything you've saved." onDismiss={() => dismiss("ai")} step="ai" />
          <span className={styles.icon}>
            <StrokeIcon name="chat" size={20} />
          </span>
          <span className={styles.title}>Ask your AI about anything you've saved.</span>
          <span>
            <Link
              className={styles.action}
              to={Routes.settingsSection("connections")}
              onClick={() => analytics.onboarding.nextSteps.chosen({ step: "ai" })}
              data-testid={onboardingNextStepsTestIds.action("ai")}
            >
              Connect your AI
            </Link>
          </span>
        </div>
      )}
    </section>
  );
}

function DismissButton({ label, step, onDismiss }: { label: string; step: NextStep; onDismiss: () => void }) {
  return (
    <button
      type="button"
      className={styles.dismiss}
      aria-label={`Dismiss: ${label}`}
      onClick={onDismiss}
      data-testid={onboardingNextStepsTestIds.dismiss(step)}
    >
      <StrokeIcon name="close" size={16} />
    </button>
  );
}
