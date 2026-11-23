import { useId, useState } from "react";
import { Link } from "react-router";
import { Routes } from "../../../../app/Routes.js";
import { OverviewMark } from "../../../../components/shared/OverviewMark/OverviewMark.js";
import { StrokeIcon, type StrokeIconName } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { NO_CARD } from "../../../../util/noCardLine.js";
import { ACCEPTED_LINKS } from "../../../onboarding/util/acceptedLinks.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { useTypingSettled } from "../../../analytics/useTypingSettled.js";
import { onboardingSourceOf } from "../../../onboarding/onboardingSources.js";
import { REFUSED_LINK } from "../../../onboarding/util/refusedLink.js";
import { useStartOnboarding } from "../../../onboarding/useStartOnboarding.js";
import styles from "./MakeYourOwnAside.module.scss";
import { makeYourOwnAsideTestIds } from "./MakeYourOwnAsideTestIds.js";

interface WhatYouGet {
  icon: StrokeIconName;
  line: string;
}

const WHAT_YOU_GET: readonly WhatYouGet[] = [
  { icon: "bookmark", line: "Save the things you want to come back to" },
  { icon: "play", line: "Get the good bits in moments, to read or listen to" },
  { icon: "chat", line: "Ask your AI about anything you’ve saved" },
];

// Why the pasted link starts onboarding: docs/features/sharing.md, "The way in". Copy from OV-327's Start (design 130q).
export const MakeYourOwnAside = () => {
  const startOnboarding = useStartOnboarding();
  const [url, setUrl] = useState("");
  const [refused, setRefused] = useState(false);
  const headingId = useId();
  const urlFieldId = useId();
  const analytics = useAnalytics();
  const settleTyping = useTypingSettled(url, () =>
    analytics.sharedPage.makeYourOwn.linkEntered({ recognised: onboardingSourceOf(url) !== null }),
  );

  const make = () => {
    settleTyping();
    analytics.sharedPage.makeYourOwn.submitted({ recognised: onboardingSourceOf(url) !== null });
    setRefused(!startOnboarding(url));
  };

  return (
    <aside className={styles.root} aria-label="Make your own overviews" data-testid={makeYourOwnAsideTestIds.root}>
      <span className={styles.mark}>
        <OverviewMark size={26} />
      </span>
      <h2 className={styles.heading} id={headingId}>
        Watch Less, with The Overview
      </h2>
      <p className={styles.body}>
        Save what you care about, get an overview plus personalised actions, and build a knowledge base you and your AI can use.
      </p>

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
            aria-label="Link to a video, page or episode"
            onChange={(event) => {
              setUrl(event.target.value);
              setRefused(false);
            }}
            aria-describedby={refused ? `${urlFieldId}-error` : undefined}
            data-testid={makeYourOwnAsideTestIds.urlField}
          />
        </div>
        {!refused && (
          <p className={styles.accepted} data-testid={makeYourOwnAsideTestIds.accepted}>
            {ACCEPTED_LINKS}
          </p>
        )}
        {refused && (
          <p id={`${urlFieldId}-error`} className={styles.error} role="alert" data-testid={makeYourOwnAsideTestIds.refused}>
            {REFUSED_LINK}
          </p>
        )}
        <button type="submit" className={styles.action} disabled={url.trim() === ""} data-testid={makeYourOwnAsideTestIds.makeButton}>
          Make my overview
        </button>
      </form>

      <p className={styles.note}>
        {NO_CARD} Have an account?{" "}
        <Link
          className={styles.link}
          to={Routes.signIn()}
          onClick={() => analytics.sharedPage.makeYourOwn.signInChosen()}
          data-testid={makeYourOwnAsideTestIds.signInLink}
        >
          Sign in
        </Link>
      </p>

      <div className={styles.whatYouGet} data-testid={makeYourOwnAsideTestIds.whatYouGet}>
        <p className={styles.whatYouGetLabel}>What you get</p>
        <ul className={styles.whatYouGetList}>
          {WHAT_YOU_GET.map(({ icon, line }) => (
            <li key={line}>
              <span className={styles.whatYouGetIcon}>
                <StrokeIcon name={icon} size={14} />
              </span>
              {line}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
};
