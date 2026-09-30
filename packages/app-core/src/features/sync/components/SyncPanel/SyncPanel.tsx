import { Link } from "react-router";
import { Routes } from "../../../../app/Routes.js";
import { useSurface } from "../../../../app/SurfaceContext.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useSync } from "../../SyncContext.js";
import { useSyncConnection } from "../../useSyncConnection.js";
import { syncStatusLine } from "../../util/syncStatusLine.js";
import styles from "./SyncPanel.module.scss";
import { syncPanelTestIds } from "./SyncPanelTestIds.js";

const WEB_NOTE = "Sign in with your email, and this browser keeps your library in step with every other device you sign in on.";
const EXTENSION_NOTE =
  "The extension keeps its own library until you sign in. Then it stays in step with the web app and every other device you sign in on.";

// Hidden entirely when the shell cannot sync: a control that cannot work is worse than no
// control (CLAUDE.md). Signed in, it is design 51a's two tiles, who and whether in step;
// signed out, it points at the sign-in and create-account pages rather than being a second
// place to ask for a link (docs/features/sync-client.md, docs/features/sign-in.md).
export function SyncPanel() {
  const sync = useSync();
  const surface = useSurface();
  const { connection } = useSyncConnection();

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
                onClick={() => void sync.signOut()}
                data-testid={syncPanelTestIds.signOutButton}
              >
                Sign in again
              </button>
            ) : (
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
          </div>
        </section>
        {!signedOut && (
          <button
            type="button"
            className={styles.signOutButton}
            onClick={() => void sync.signOut()}
            data-testid={syncPanelTestIds.signOutButton}
          >
            Sign out
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
    </div>
  );
}
