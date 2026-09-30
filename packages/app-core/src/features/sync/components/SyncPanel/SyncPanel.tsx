import { Link } from "react-router";
import { Routes } from "../../../../app/Routes.js";
import { useSurface } from "../../../../app/SurfaceContext.js";
import { useSync } from "../../SyncContext.js";
import { useSyncConnection } from "../../useSyncConnection.js";
import { syncStatusLine } from "../../util/syncStatusLine.js";
import styles from "./SyncPanel.module.scss";
import { syncPanelTestIds } from "./SyncPanelTestIds.js";

const WEB_NOTE = "Sign in with your email, and this browser keeps your library in step with every other device you sign in on.";
const EXTENSION_NOTE =
  "Sign in with your email, and the extension keeps its library in step with the web app and every other device you sign in on.";

// Hidden entirely when the shell cannot sync: a control that cannot work is worse than no
// control (CLAUDE.md). Signed in, it shows the one status line and the two things a reader
// can do; signed out, it points at the sign-in and create-account pages rather than being
// a second place to ask for a link (docs/features/sync-client.md, docs/features/sign-in.md).
export function SyncPanel() {
  const sync = useSync();
  const surface = useSurface();
  const { connection } = useSyncConnection();

  if (!sync.available) {
    return null;
  }

  if (sync.connected) {
    const signedOut = sync.status.phase === "signedOut";
    return (
      <section className={styles.root} data-testid={syncPanelTestIds.root}>
        <p className={styles.heading}>Sync</p>
        {connection.email !== null && (
          <p className={styles.status} data-testid={syncPanelTestIds.signedInAs}>
            Signed in as {connection.firstName === null ? connection.email : `${connection.firstName} (${connection.email})`}
          </p>
        )}
        <p className={styles.status} data-testid={syncPanelTestIds.statusLine}>
          {syncStatusLine(sync.status, new Date())}
        </p>
        <div className={styles.actions}>
          {!signedOut && (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={sync.syncNow}
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
              data-testid={syncPanelTestIds.connectExtensionLink}
            >
              Connect the extension
            </Link>
          )}
          <button
            type="button"
            className={signedOut ? styles.primaryButton : styles.quietButton}
            onClick={() => void sync.signOut()}
            data-testid={syncPanelTestIds.signOutButton}
          >
            {signedOut ? "Sign in again" : "Sign out"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.root} data-testid={syncPanelTestIds.root}>
      <p className={styles.heading}>Sync</p>
      <p className={styles.hint}>{surface === "web" ? WEB_NOTE : EXTENSION_NOTE}</p>
      <div className={styles.actions}>
        <Link className={styles.primaryButton} to={Routes.signIn()} data-testid={syncPanelTestIds.signInLink}>
          Sign in
        </Link>
        <Link
          className={styles.secondaryButton}
          to={Routes.createAccount()}
          data-testid={syncPanelTestIds.createAccountLink}
        >
          Create account
        </Link>
      </div>
    </section>
  );
}
