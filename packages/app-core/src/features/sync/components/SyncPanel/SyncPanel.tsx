import { Link } from "react-router";
import { Routes } from "../../../../app/Routes.js";
import { useSurface } from "../../../../app/SurfaceContext.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useSync } from "../../SyncContext.js";
import { useSyncConnection } from "../../useSyncConnection.js";
import { syncStatusLine } from "../../util/syncStatusLine.js";
import styles from "./SyncPanel.module.scss";
import { syncPanelTestIds } from "./SyncPanelTestIds.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { useSignedOutHere } from "../../../accountLibraries/useSignedOutHere.js";
import { overviewsNoun, savedHere } from "../../../accountLibraries/util/libraryPlace.js";
import { useOverviewsWithStateQuery } from "../../../overviews/queries/overviewsWithStateQuery.js";

const WEB_NOTE = "Sign in with your email, and this browser keeps your library in step with every other device you sign in on.";
const EXTENSION_NOTE =
  "The extension keeps its own library until you sign in. Then it stays in step with the web app and every other device you sign in on.";

// Hidden entirely when the shell cannot sync: a control that cannot work is worse than no
// control (CLAUDE.md). Signed in, it is design 51a's two tiles, who and whether in step;
// signed out, it points at the sign-in and create-account pages rather than being a second
// place to ask for a link, and once this device has signed out of an account it says where
// the library is kept (design 47g, docs/features/account-libraries.md).
export function SyncPanel() {
  const analytics = useAnalytics();
  const sync = useSync();
  const surface = useSurface();
  const { connection } = useSyncConnection();
  const signedOutHere = useSignedOutHere();
  const heldHere = useOverviewsWithStateQuery().data?.length ?? 0;

  if (!sync.available) {
    return null;
  }

  if (sync.connected) {
    const signedOut = sync.status.phase === "signedOut";
    const inStep = sync.status.phase === "idle" && sync.status.pending === 0 && sync.status.stuck === 0;
    return (
      <div className={styles.root} data-testid={syncPanelTestIds.root}>
        {connection.email !== null && (
          <section className={styles.tile}>
            <p className={styles.heading}>Signed in as</p>
            <p className={styles.who} data-testid={syncPanelTestIds.signedInAs}>
              {connection.firstName === null ? (
                connection.email
              ) : (
                <>
                  {connection.firstName} <span className={styles.email}>({connection.email})</span>
                </>
              )}
            </p>
          </section>
        )}
        <section className={styles.tile}>
          <p className={styles.heading}>Sync</p>
          <p className={styles.status} data-testid={syncPanelTestIds.statusLine}>
            {inStep && (
              <span className={styles.statusIcon}>
                <StrokeIcon name="check" size={16} />
              </span>
            )}
            {syncStatusLine(sync.status, new Date())}
          </p>
          <div className={styles.actions}>
            {signedOut ? (
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => {
                  analytics.settings.sync.signOutChosen({ signedOutAtServer: true });
                  void sync.signOut();
                }}
                data-testid={syncPanelTestIds.signOutButton}
              >
                Sign in again
              </button>
            ) : (
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => {
                  analytics.settings.sync.syncNowChosen();
                  sync.syncNow();
                }}
                disabled={sync.status.phase === "syncing"}
                data-testid={syncPanelTestIds.syncNowButton}
              >
                Sync now
              </button>
            )}
            {surface === "web" && !signedOut && (
              <Link
                className={styles.secondaryButton}
                to={Routes.connectExtension()}
                onClick={() => analytics.settings.sync.connectExtensionChosen()}
                data-testid={syncPanelTestIds.connectExtensionLink}
              >
                Connect the extension
              </Link>
            )}
          </div>
        </section>
        {!signedOut && (
          <button
            type="button"
            className={styles.signOutButton}
            onClick={() => {
              if (sync.signingOut) return;
              analytics.settings.sync.signOutChosen({ signedOutAtServer: false });
              void sync.signOut();
            }}
            aria-disabled={sync.signingOut}
            aria-live="polite"
            data-testid={syncPanelTestIds.signOutButton}
          >
            {sync.signingOut ? (
              <>
                <span className={styles.spinner}>
                  <StrokeIcon name="loader" size={16} />
                </span>
                Syncing before you sign out…
              </>
            ) : (
              "Sign out"
            )}
          </button>
        )}
      </div>
    );
  }

  if (signedOutHere) {
    return (
      <div className={styles.root} data-testid={syncPanelTestIds.root}>
        <section className={styles.tile} data-testid={syncPanelTestIds.signedOutHere}>
          <p className={styles.signedOutTitle}>You’re signed out</p>
          <p className={styles.signedOutBody} data-testid={syncPanelTestIds.hint}>
            {heldHere === 0
              ? "Your Overviews are safe in your account. Sign in to get them back."
              : `${heldHere} ${overviewsNoun(heldHere)} ${heldHere === 1 ? "is" : "are"} only saved ${savedHere(surface)}. Sign in or create an account to sync them to your account and access them on any device.`}
          </p>
          <div className={styles.actions}>
            <Link
              className={styles.primaryButton}
              to={Routes.signIn()}
              onClick={() => analytics.settings.sync.signInChosen()}
              data-testid={syncPanelTestIds.signInLink}
            >
              <StrokeIcon name="signIn" size={16} />
              Sign in
            </Link>
            <Link
              className={styles.secondaryButton}
              to={Routes.createAccount()}
              onClick={() => analytics.settings.sync.createAccountChosen()}
              data-testid={syncPanelTestIds.createAccountLink}
            >
              Create account
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.root} data-testid={syncPanelTestIds.root}>
      <section className={styles.tile}>
        <p className={styles.heading}>Sync</p>
        <p className={styles.hint} data-testid={syncPanelTestIds.hint}>
          {surface === "web" ? WEB_NOTE : EXTENSION_NOTE}
        </p>
        <div className={styles.actions}>
          <Link
            className={styles.primaryButton}
            to={Routes.signIn()}
            onClick={() => analytics.settings.sync.signInChosen()}
            data-testid={syncPanelTestIds.signInLink}
          >
            Sign in
          </Link>
          <Link
            className={styles.secondaryButton}
            to={Routes.createAccount()}
            onClick={() => analytics.settings.sync.createAccountChosen()}
            data-testid={syncPanelTestIds.createAccountLink}
          >
            Create account
          </Link>
        </div>
      </section>
    </div>
  );
}
