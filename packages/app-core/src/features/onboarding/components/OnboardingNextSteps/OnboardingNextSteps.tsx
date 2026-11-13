import { useId, useState } from "react";
import type { OverviewId } from "@overview/domain";
import { useIsPanel } from "../../../../app/LayoutContext.js";
import { Routes } from "../../../../app/Routes.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { PastedLinkStatus } from "../../../newOverview/components/PastedLinkStatus/PastedLinkStatus.js";
import { useStartFromLink } from "../../../newOverview/useStartFromLink.js";
import { readNextSteps, writeNextSteps, type NextStep } from "../../nextStepsStorage.js";
import styles from "./OnboardingNextSteps.module.scss";
import { onboardingNextStepsTestIds } from "./OnboardingNextStepsTestIds.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";

// Design 46l: under the Verdict of onboarding's overview, the extension and the AI connection,
// each dismissible, and never a modal. Shown only on the overview onboarding ended on. The panel
// is the extension already, so there it offers the AI connection alone. After a sample, making
// one of their own comes first (155k).
export function OnboardingNextSteps({ overviewId }: { overviewId: OverviewId }) {
  const analytics = useAnalytics();
  const isPanel = useIsPanel();
  const [nextSteps, setNextSteps] = useState(readNextSteps);
  if (nextSteps === null || nextSteps.overviewId !== overviewId) return null;

  const shown = (step: NextStep) => !nextSteps.dismissed.includes(step) && !(isPanel && step === "extension");
  const dismiss = (step: NextStep) => {
    analytics.onboarding.nextSteps.dismissed({ step });
    const next = { ...(readNextSteps() ?? nextSteps), dismissed: [...nextSteps.dismissed, step] };
    writeNextSteps(next);
    setNextSteps(next);
  };
  const ownShown = nextSteps.sample && shown("own");
  if (!ownShown && !shown("extension") && !shown("ai")) return null;

  return (
    <section className={styles.root} aria-label="Next steps" data-testid={onboardingNextStepsTestIds.root}>
      {ownShown && <TryYourOwn onDismiss={() => dismiss("own")} />}
      <div className={styles.row}>
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
              <PageLink
                className={styles.action}
                to={Routes.settingsSection("connections")}
                onClick={() => analytics.onboarding.nextSteps.chosen({ step: "ai" })}
                data-testid={onboardingNextStepsTestIds.action("ai")}
              >
                Connect your AI
              </PageLink>
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

// Design 155k: after a sample, the first next step is making one of their own, with its own
// field, so the next overview can start without leaving the page. It's the shell's own run, as
// the empty library's field starts, and it hides when there's no way to make one.
function TryYourOwn({ onDismiss }: { onDismiss: () => void }) {
  const analytics = useAnalytics();
  const { ready, limit, url, setUrl, validationError, generate, article, podcast, pasted } = useStartFromLink();
  const headingId = useId();
  const fieldId = useId();
  if (!ready || limit !== null) return null;
  return (
    <section className={`${styles.card} ${styles.own}`} aria-labelledby={headingId} data-testid={onboardingNextStepsTestIds.card("own")}>
      <DismissButton label="Now try your own" onDismiss={onDismiss} step="own" />
      <span className={styles.icon}>
        <StrokeIcon name="link" size={20} />
      </span>
      <h2 id={headingId} className={styles.title}>
        Now try your own.
      </h2>
      <p className={styles.body}>
        Paste a link to a video or a page you've been meaning to get to. We'll write it for you, from what you told us.
      </p>
      <form
        className={styles.ownForm}
        onSubmit={(event) => {
          analytics.onboarding.nextSteps.chosen({ step: "own" });
          generate(event);
        }}
      >
        <label htmlFor={fieldId} className={styles.visuallyHidden}>
          Link
        </label>
        <input
          id={fieldId}
          className={styles.ownInput}
          type="url"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="Paste a link to a video or a page"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          data-testid={onboardingNextStepsTestIds.ownField}
        />
        <button
          type="submit"
          className={styles.ownSubmit}
          disabled={url.trim() === "" || pasted.reading}
          data-testid={onboardingNextStepsTestIds.action("own")}
        >
          Make an overview
        </button>
      </form>
      <PastedLinkStatus article={article} podcast={podcast} url={url.trim()} onClear={() => setUrl("")} />
      {validationError !== null && (
        <p className={styles.ownError} role="alert">
          {validationError}
        </p>
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
