import { useId, useState } from "react";
import type { OverviewId } from "@overview/domain";
import { Routes } from "../../../../app/Routes.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { CHROME_EXTENSION_URL } from "../../../../util/chromeExtensionUrl.js";
import { useExtensionOffered } from "../../../../util/useExtensionOffered.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { createLabelOf } from "../../../podcasts/util/episodeActionOf.js";
import { PastedLinkStatus } from "../../../newOverview/components/PastedLinkStatus/PastedLinkStatus.js";
import { useStartFromLink } from "../../../newOverview/useStartFromLink.js";
import { readNextSteps, writeNextSteps, type NextStep } from "../../nextStepsStorage.js";
import styles from "./OnboardingNextSteps.module.scss";
import { onboardingNextStepsTestIds } from "./OnboardingNextStepsTestIds.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";

// Never a modal, and shown only on the overview onboarding ended on (46l, 155k).
export const OnboardingNextSteps = ({ overviewId }: { overviewId: OverviewId }) => {
  const analytics = useAnalytics();
  const extensionOffered = useExtensionOffered();
  const [nextSteps, setNextSteps] = useState(readNextSteps);
  if (nextSteps === null || nextSteps.overviewId !== overviewId) {
    return null;
  }

  const shown = (step: NextStep) => !nextSteps.dismissed.includes(step) && (extensionOffered || step !== "extension");
  const dismiss = (step: NextStep) => {
    analytics.onboarding.nextSteps.dismissed({ step });
    const next = { ...(readNextSteps() ?? nextSteps), dismissed: [...nextSteps.dismissed, step] };
    writeNextSteps(next);
    setNextSteps(next);
  };
  const ownShown = nextSteps.sample && shown("own");
  if (!ownShown && !shown("extension") && !shown("ai")) {
    return null;
  }

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
              <a
                className={styles.action}
                href={CHROME_EXTENSION_URL}
                target="_blank"
                rel="noopener"
                aria-label="Add to Chrome, opens in a new tab"
                onClick={() => analytics.onboarding.nextSteps.chosen({ step: "extension" })}
                data-testid={onboardingNextStepsTestIds.action("extension")}
              >
                Add to Chrome
              </a>
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
};

// The shell's own run, as the empty library's field starts, so it hides when there's no way to make one.
const TryYourOwn = ({ onDismiss }: { onDismiss: () => void }) => {
  const analytics = useAnalytics();
  const { ready, limit, url, setUrl, validationError, generate, article, podcast, tiktok, social, pasted } = useStartFromLink();
  const headingId = useId();
  const fieldId = useId();
  if (!ready || limit !== null) {
    return null;
  }
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
          {pasted.episodeAction === null ? "Make an overview" : createLabelOf(pasted.episodeAction, "Make an overview")}
        </button>
      </form>
      <PastedLinkStatus article={article} podcast={podcast} tiktok={tiktok} social={social} url={url.trim()} onClear={() => setUrl("")} />
      {validationError !== null && (
        <p className={styles.ownError} role="alert">
          {validationError}
        </p>
      )}
    </section>
  );
};

interface DismissButtonProps {
  label: string;
  step: NextStep;
  onDismiss: () => void;
}

const DismissButton = ({ label, step, onDismiss }: DismissButtonProps) => {
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
};
