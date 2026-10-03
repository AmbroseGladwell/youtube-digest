import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { Routes } from "../../../../app/Routes.js";
import { useSurface } from "../../../../app/SurfaceContext.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { useStartFromLink } from "../../../newOverview/useStartFromLink.js";
import { savedHere } from "../../util/libraryPlace.js";
import styles from "./SignedOutLibrary.module.scss";
import { signedOutLibraryTestIds } from "./SignedOutLibraryTestIds.js";

// Design 47b: the library at / when it is empty and this device has signed out of an
// account. It leads with what is safe rather than what is missing, names no address, and
// still takes a link, since the next person at a shared device may not be the account's
// (docs/features/account-libraries.md).
export function SignedOutLibrary() {
  const surface = useSurface();
  const { ready, url, setUrl, validationError, generate } = useStartFromLink();
  const heading = useRef<HTMLHeadingElement | null>(null);
  const analytics = useAnalytics();

  useEffect(() => heading.current?.focus(), []);

  return (
    <div className={styles.root} data-testid={signedOutLibraryTestIds.root}>
      <h1 className={styles.title} ref={heading} tabIndex={-1}>
        You’re signed out
      </h1>
      <p className={styles.lead}>
        Your Overviews are safe in your account. Sign in to get them back, including any changes from your
        other devices.
      </p>
      <p className={styles.aside}>
        Anything you make while signed out is saved {savedHere(surface)} and added to your account when you
        sign in.
      </p>
      <div>
        <Link
          className={styles.signIn}
          to={Routes.signIn()}
          onClick={() => analytics.account.signedOutLibrary.signInChosen()}
          data-testid={signedOutLibraryTestIds.signIn}
        >
          <StrokeIcon name="signIn" size={17} />
          Sign in
        </Link>
      </div>

      {ready && (
        <div className={styles.start}>
          <p className={styles.startLabel}>Or start with a video</p>
          <form className={styles.form} onSubmit={generate}>
            <label className={styles.field}>
              <span className={styles.fieldIcon}>
                <StrokeIcon name="link" size={18} />
              </span>
              <input
                type="url"
                className={styles.input}
                placeholder="Paste a YouTube link"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                aria-label="YouTube link"
                data-testid={signedOutLibraryTestIds.urlInput}
              />
            </label>
            <button type="submit" className={styles.generate} data-testid={signedOutLibraryTestIds.generate}>
              Generate overview
            </button>
          </form>
          {validationError && <p className={styles.error}>{validationError}</p>}
        </div>
      )}
    </div>
  );
}
