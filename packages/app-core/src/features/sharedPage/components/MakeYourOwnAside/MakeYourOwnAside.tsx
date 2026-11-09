import { useId, useState } from "react";
import { Link } from "react-router";
import { Routes } from "../../../../app/Routes.js";
import { OverviewMark } from "../../../../components/shared/OverviewMark/OverviewMark.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { useTypingSettled } from "../../../analytics/useTypingSettled.js";
import { onboardingSourceOf } from "../../../onboarding/onboardingSources.js";
import { REFUSED_LINK } from "../../../onboarding/util/refusedLink.js";
import { useStartOnboarding } from "../../../onboarding/useStartOnboarding.js";
import styles from "./MakeYourOwnAside.module.scss";
import { makeYourOwnAsideTestIds } from "./MakeYourOwnAsideTestIds.js";

const PLUS = [
  "Audio overviews, like this one",
  "Ask your AI assistant about your library, through an MCP connection",
  "Your library synced across your devices",
];

// Design 30e: the page is also the way in. The pasted link starts onboarding, as Start's does,
// so the visitor is asked what shapes it before the account (docs/features/sharing.md).
export function MakeYourOwnAside() {
  const startOnboarding = useStartOnboarding();
  const [url, setUrl] = useState("");
  const [refused, setRefused] = useState(false);
  const headingId = useId();
  const urlFieldId = useId();
  const analytics = useAnalytics();
  useTypingSettled(url, () => analytics.sharedPage.makeYourOwn.linkEntered({ recognised: onboardingSourceOf(url) !== null }));

  const make = () => {
    analytics.sharedPage.makeYourOwn.submitted({ recognised: onboardingSourceOf(url) !== null });
    setRefused(!startOnboarding(url));
  };

  return (
    <aside className={styles.root} aria-labelledby={headingId} data-testid={makeYourOwnAsideTestIds.root}>
      <span className={styles.mark}>
        <OverviewMark size={26} />
      </span>
      <h2 className={styles.heading} id={headingId}>
        Watch Less, with The Overview
      </h2>
      <p className={styles.body}>Paste a link to a video or a page and we'll make an overview of it, to read or listen to.</p>

      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          make();
        }}
      >
        <div className={styles.field}>
          <input
            id={urlFieldId}
            name="video-url"
            type="url"
            autoComplete="off"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={url}
            placeholder="Paste a link"
            aria-label="Link"
            onChange={(event) => {
              setUrl(event.target.value);
              setRefused(false);
            }}
            aria-describedby={refused ? `${urlFieldId}-error` : undefined}
            data-testid={makeYourOwnAsideTestIds.urlField}
          />
        </div>
        {refused && (
          <p id={`${urlFieldId}-error`} className={styles.error} role="alert" data-testid={makeYourOwnAsideTestIds.refused}>
            {REFUSED_LINK}
          </p>
        )}
        <button type="submit" className={styles.action} disabled={url.trim() === ""} data-testid={makeYourOwnAsideTestIds.makeButton}>
          Make an overview
        </button>
      </form>

      <p className={styles.note}>
        Free to start. Have an account?{" "}
        <Link
          className={styles.link}
          to={Routes.signIn()}
          onClick={() => analytics.sharedPage.makeYourOwn.signInChosen()}
          data-testid={makeYourOwnAsideTestIds.signInLink}
        >
          Sign in
        </Link>
      </p>

      <div className={styles.plus} data-testid={makeYourOwnAsideTestIds.plusList}>
        <span className={styles.plusChip}>Plus</span>
        <ul className={styles.plusList}>
          {PLUS.map((line) => (
            <li key={line}>
              <span className={styles.tick}>
                <StrokeIcon name="check" size={14} />
              </span>
              {line}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
