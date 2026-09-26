import { useState, type FormEvent } from "react";
import { useSurface } from "../../../../app/SurfaceContext.js";
import { useSync } from "../../SyncContext.js";
import { useSyncConnection } from "../../useSyncConnection.js";
import { syncStatusLine } from "../../util/syncStatusLine.js";
import styles from "./SyncPanel.module.scss";
import { syncPanelTestIds } from "./SyncPanelTestIds.js";

const SIGN_IN_NOTE =
  "Syncing needs an account, and sign-in isn't built yet. Until it is, a session token minted " +
  "on the server stands in for one: paste it here with the server's address.";

const trimmedOrNull = (raw: string): string | null => (raw.trim() === "" ? null : raw.trim());

const isUrl = (value: string): boolean => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

// Hidden entirely when the shell cannot sync: a control that cannot work is worse than no
// control (CLAUDE.md). Connected, it shows the one status line and the two things a reader
// can do; disconnected, it asks for the server and the token (docs/features/sync-client.md).
export function SyncPanel() {
  const sync = useSync();
  const surface = useSurface();
  const { connection, setConnection } = useSyncConnection();
  const [apiUrl, setApiUrl] = useState(
    connection.apiUrl ?? (surface === "web" ? globalThis.location?.origin ?? "" : ""),
  );
  const [token, setToken] = useState(connection.token ?? "");
  const [refused, setRefused] = useState(false);

  if (!sync.available) {
    return null;
  }

  const connect = (event: FormEvent) => {
    event.preventDefault();
    const nextUrl = trimmedOrNull(apiUrl);
    const nextToken = trimmedOrNull(token);
    if (nextUrl === null || nextToken === null || !isUrl(nextUrl)) {
      setRefused(true);
      return;
    }
    setRefused(false);
    setConnection({ apiUrl: nextUrl, token: nextToken });
  };

  return (
    <section className={styles.root} data-testid={syncPanelTestIds.root}>
      <p className={styles.heading}>Sync</p>
      {sync.connected ? (
        <>
          <p className={styles.status} data-testid={syncPanelTestIds.statusLine}>
            {syncStatusLine(sync.status, new Date())}
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={sync.syncNow}
              disabled={sync.status.phase === "syncing"}
              data-testid={syncPanelTestIds.syncNowButton}
            >
              Sync now
            </button>
            <button
              type="button"
              className={styles.quietButton}
              onClick={() => {
                setToken("");
                void sync.disconnect();
              }}
              data-testid={syncPanelTestIds.disconnectButton}
            >
              Disconnect
            </button>
          </div>
        </>
      ) : (
        <form className={styles.form} onSubmit={connect}>
          <p className={styles.hint}>{SIGN_IN_NOTE}</p>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="sync-api-url">
              Server address
            </label>
            <input
              id="sync-api-url"
              className={styles.input}
              type="url"
              autoComplete="off"
              value={apiUrl}
              onChange={(event) => setApiUrl(event.target.value)}
              data-testid={syncPanelTestIds.apiUrlInput}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="sync-token">
              Session token
            </label>
            <input
              id="sync-token"
              className={styles.input}
              type="password"
              autoComplete="off"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              data-testid={syncPanelTestIds.tokenInput}
            />
          </div>
          {refused && <p className={styles.status}>Both are needed, and the address has to be a URL.</p>}
          <button type="submit" className={styles.primaryButton} data-testid={syncPanelTestIds.connectButton}>
            Connect
          </button>
        </form>
      )}
    </section>
  );
}
