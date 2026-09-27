import { useState, type FormEvent } from "react";
import { useDefaultApiUrl } from "../../../../app/DefaultApiUrlContext.js";
import { useSurface } from "../../../../app/SurfaceContext.js";
import { useExchangeLinkCodeMutation } from "../../../auth/mutations/useExchangeLinkCodeMutation.js";
import { useRequestMagicLinkMutation } from "../../../auth/mutations/useRequestMagicLinkMutation.js";
import { authFailureMessage, CODE_SPENT } from "../../../auth/util/authFailureMessage.js";
import { useSync } from "../../SyncContext.js";
import { useSyncConnection } from "../../useSyncConnection.js";
import { syncStatusLine } from "../../util/syncStatusLine.js";
import styles from "./SyncPanel.module.scss";
import { syncPanelTestIds } from "./SyncPanelTestIds.js";

const WEB_NOTE = "Sign in with your email, and this browser keeps your library in step with every other device you sign in on.";
const EXTENSION_NOTE =
  "Sign in with your email. The link opens a page with a code; enter the code here and the extension is signed in.";

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
// control (CLAUDE.md). Signed in, it shows the one status line and the two things a reader
// can do; signed out, it asks for an email, and in the extension for the server and then
// the code (docs/features/sync-client.md, docs/features/sign-in.md).
export function SyncPanel() {
  const sync = useSync();
  const surface = useSurface();
  const defaultApiUrl = useDefaultApiUrl();
  const { connection, setConnection } = useSyncConnection();
  const [apiUrl, setApiUrl] = useState(connection.apiUrl ?? defaultApiUrl ?? "");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [refused, setRefused] = useState<string | null>(null);
  const requestLink = useRequestMagicLinkMutation();
  const exchangeCode = useExchangeLinkCodeMutation();

  if (!sync.available) {
    return null;
  }

  const serverUrl = surface === "web" ? (globalThis.location?.origin ?? "") : trimmedOrNull(apiUrl);

  const sendLink = (event: FormEvent) => {
    event.preventDefault();
    const address = trimmedOrNull(email);
    if (serverUrl === null || !isUrl(serverUrl)) {
      setRefused("The server address has to be a URL.");
      return;
    }
    if (address === null) {
      setRefused("An email address is needed.");
      return;
    }
    setRefused(null);
    requestLink.mutate(
      { apiUrl: serverUrl, email: address, surface },
      { onError: (error) => setRefused(authFailureMessage(error, CODE_SPENT)) },
    );
  };

  const connect = (event: FormEvent) => {
    event.preventDefault();
    const typed = trimmedOrNull(code);
    if (serverUrl === null || !isUrl(serverUrl)) {
      setRefused("The server address has to be a URL.");
      return;
    }
    if (typed === null) {
      setRefused("Enter the code from the sign-in page.");
      return;
    }
    setRefused(null);
    exchangeCode.mutate(
      { apiUrl: serverUrl, code: typed },
      {
        onSuccess: (linked) => {
          setCode("");
          setConnection({ apiUrl: serverUrl, token: linked.token, email: linked.email });
        },
        onError: (error) => setRefused(authFailureMessage(error, CODE_SPENT)),
      },
    );
  };

  if (sync.connected) {
    const signedOut = sync.status.phase === "signedOut";
    return (
      <section className={styles.root} data-testid={syncPanelTestIds.root}>
        <p className={styles.heading}>Sync</p>
        {connection.email !== null && (
          <p className={styles.status} data-testid={syncPanelTestIds.signedInAs}>
            Signed in as {connection.email}
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

  const sentTo = requestLink.isSuccess ? requestLink.variables.email : null;

  return (
    <section className={styles.root} data-testid={syncPanelTestIds.root}>
      <p className={styles.heading}>Sync</p>
      <p className={styles.hint}>{surface === "web" ? WEB_NOTE : EXTENSION_NOTE}</p>

      {sentTo !== null ? (
        <div className={styles.form}>
          <p className={styles.status} data-testid={syncPanelTestIds.linkSent}>
            {surface === "web"
              ? `Check your email. The link we sent to ${sentTo} works for fifteen minutes and signs this browser in.`
              : `Check your email. Open the link we sent to ${sentTo}, then enter the code it shows below.`}
          </p>
          <button
            type="button"
            className={styles.quietButton}
            onClick={() => requestLink.reset()}
            data-testid={syncPanelTestIds.changeAddressButton}
          >
            Use a different address
          </button>
        </div>
      ) : (
        <form className={styles.form} onSubmit={sendLink}>
          {surface === "extension" && (
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
          )}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="sync-email">
              Email
            </label>
            <input
              id="sync-email"
              className={styles.input}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              data-testid={syncPanelTestIds.emailInput}
            />
          </div>
          <button
            type="submit"
            className={styles.primaryButton}
            disabled={requestLink.isPending}
            data-testid={syncPanelTestIds.requestLinkButton}
          >
            Email me a link
          </button>
        </form>
      )}

      {surface === "extension" && (
        <form className={styles.form} onSubmit={connect}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="sync-link-code">
              Code from the sign-in page
            </label>
            <input
              id="sync-link-code"
              className={styles.input}
              type="text"
              autoComplete="one-time-code"
              autoCapitalize="characters"
              spellCheck={false}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              data-testid={syncPanelTestIds.codeInput}
            />
          </div>
          <button
            type="submit"
            className={styles.primaryButton}
            disabled={exchangeCode.isPending}
            data-testid={syncPanelTestIds.connectButton}
          >
            Connect
          </button>
        </form>
      )}

      {refused !== null && (
        <p className={styles.status} data-testid={syncPanelTestIds.formError}>
          {refused}
        </p>
      )}
    </section>
  );
}
