import { useState } from "react";
import { Routes } from "../../../../app/Routes.js";
import { useSurface } from "../../../../app/SurfaceContext.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useSync } from "../../SyncContext.js";
import { useSyncConnection } from "../../useSyncConnection.js";
import { syncStatusLine } from "../../util/syncStatusLine.js";
import styles from "./SyncPanel.module.scss";
import { syncPanelTestIds } from "./SyncPanelTestIds.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { useSignOut } from "../../../accountLibraries/useSignOut.js";
import { AccountTile } from "../../../auth/components/AccountTile/AccountTile.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";

const WEB_NOTE = "Sign in with your email, and this browser keeps your library in step with every other device you sign in on.";
const EXTENSION_NOTE =
  "Sign in with your email, and the extension keeps your library in step with the web app and every other device you sign in on.";

// Hidden entirely when the shell cannot sync: a control that cannot work is worse than no
// control (CLAUDE.md). Signed in, it is design 51a's two tiles, who and whether in step;
// signed out, it points at the sign-in and create-account pages rather than being a second
// place to ask for a link. While an account row is open its Save is the only orange on the
// screen, so Sync now steps down until it closes (design 14a).
export function SyncPanel() {
  const analytics = useAnalytics();
  const sync = useSync();
  const signOut = useSignOut();
  const surface = useSurface();
  const { connection } = useSyncConnection();
  const [editingAccount, setEditingAccount] = useState(false);

  if (!sync.available) {
    return null;
  }

  if (sync.connected) {
    const signedOut = sync.status.phase === "signedOut";
    const inStep = sync.status.phase === "idle" && sync.status.pending === 0 && sync.status.stuck === 0;
    return (
      <div className={styles.root} data-testid={syncPanelTestIds.root}>
        {connection.email !== null && (
          <AccountTile email={connection.email} firstName={connection.firstName} onEditingChange={setEditingAccount} />
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
                  void signOut();
                }}
                data-testid={syncPanelTestIds.signOutButton}
              >
                Sign in again
              </button>
            ) : (
              <button
                type="button"
                className={editingAccount ? styles.secondaryButton : styles.primaryButton}
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
              <PageLink
                className={styles.secondaryButton}
                to={Routes.connectExtension()}
                onClick={() => analytics.settings.sync.connectExtensionChosen()}
                data-testid={syncPanelTestIds.connectExtensionLink}
              >
                Connect the extension
              </PageLink>
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
              void signOut();
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

  return (
    <div className={styles.root} data-testid={syncPanelTestIds.root}>
      <section className={styles.tile}>
        <p className={styles.heading}>Sync</p>
        <p className={styles.hint} data-testid={syncPanelTestIds.hint}>
          {surface === "web" ? WEB_NOTE : EXTENSION_NOTE}
        </p>
        <div className={styles.actions}>
          <PageLink
            className={styles.primaryButton}
            to={Routes.signIn()}
            onClick={() => analytics.settings.sync.signInChosen()}
            data-testid={syncPanelTestIds.signInLink}
          >
            Sign in
          </PageLink>
          <PageLink
            className={styles.secondaryButton}
            to={Routes.createAccount()}
            onClick={() => analytics.settings.sync.createAccountChosen()}
            data-testid={syncPanelTestIds.createAccountLink}
          >
            Create account
          </PageLink>
        </div>
      </section>
    </div>
  );
}
