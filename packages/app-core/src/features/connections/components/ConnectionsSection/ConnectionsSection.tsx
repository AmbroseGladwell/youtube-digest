import { useRef } from "react";
import { Link } from "react-router";
import { canConnectAssistant } from "@overview/domain";
import { isSyncRequestError } from "@overview/sync";
import { Routes } from "../../../../app/Routes.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useSessionQuery } from "../../../auth/queries/sessionQuery.js";
import { useSync } from "../../../sync/SyncContext.js";
import { useSyncConnection } from "../../../sync/useSyncConnection.js";
import { useRevokeConnectionMutation } from "../../mutations/useRevokeConnectionMutation.js";
import { useConnectionsQuery } from "../../queries/connectionsQuery.js";
import { ConnectionRow } from "../ConnectionRow/ConnectionRow.js";
import { ConnectorSetup } from "../ConnectorSetup/ConnectorSetup.js";
import { ExampleQuestions } from "../ExampleQuestions/ExampleQuestions.js";
import styles from "./ConnectionsSection.module.scss";
import { connectionsSectionTestIds } from "./ConnectionsSectionTestIds.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";

export const CONNECTIONS_INTRO =
  "Let Claude or another assistant read your overviews and transcripts, so you can ask about everything you’ve saved. Read-only.";

// Design 58i–58r. A connection belongs to an account on Plus, so signed out and Free each
// say what it would take rather than showing controls that cannot work.
export function ConnectionsSection() {
  const analytics = useAnalytics();
  const sync = useSync();
  const { connection } = useSyncConnection();
  const session = useSessionQuery();
  const connections = useConnectionsQuery();
  const revoke = useRevokeConnectionMutation();
  const connectedLabel = useRef<HTMLParagraphElement>(null);
  const setupLabel = useRef<HTMLParagraphElement>(null);
  const now = new Date();

  const sessionEnded = isSyncRequestError(session.error) && session.error.code === "unauthenticated";

  if (!sync.connected || sessionEnded) {
    return (
      <div className={styles.card} data-testid={connectionsSectionTestIds.signInFirst}>
        <p className={styles.label}>Sign in first</p>
        <p className={styles.body}>
          A connection belongs to your account, not to this browser. Sign in, then connect an assistant from here or
          from the web app.
        </p>
        <div className={styles.actions}>
          <Link
            to={Routes.signIn()}
            className={styles.primary}
            onClick={() => analytics.mcp.settingsConnections.signInChosen()}
            data-testid={connectionsSectionTestIds.signInLink}
          >
            Sign in
          </Link>
          <Link
            to={Routes.createAccount()}
            className={styles.secondary}
            onClick={() => analytics.mcp.settingsConnections.createAccountChosen()}
            data-testid={connectionsSectionTestIds.createAccountLink}
          >
            Create account
          </Link>
        </div>
      </div>
    );
  }

  if (session.isError) {
    return (
      <p className={styles.error} role="alert" data-testid={connectionsSectionTestIds.error}>
        <StrokeIcon name="alertCircle" size={14} />
        Your account couldn't be checked.{" "}
        <button type="button" className={styles.retry} onClick={() => {
            analytics.mcp.settingsConnections.retried();
            void session.refetch();
          }}>
          Try again
        </button>
      </p>
    );
  }

  if (session.data === undefined) {
    return <div className={styles.pending} aria-busy="true" data-testid={connectionsSectionTestIds.pending} />;
  }

  if (!canConnectAssistant(session.data.plan)) {
    return (
      <div className={styles.offer} data-testid={connectionsSectionTestIds.plusOffer}>
        <p className={styles.label}>Comes with Plus</p>
        <p className={styles.body}>
          Connect Claude or another assistant and it can read every overview and transcript you’ve saved, and answer
          across them. Read-only.
        </p>
        <ExampleQuestions onTint />
        <div className={styles.actions}>
          <Link
            to={Routes.settingsSection("plan")}
            className={styles.primary}
            onClick={() => analytics.mcp.settingsConnections.seePlusChosen()}
            data-testid={connectionsSectionTestIds.seePlusLink}
          >
            See Plus
          </Link>
          <span className={styles.onFree}>You’re on Free.</span>
        </div>
      </div>
    );
  }

  const address = `${(connection.apiUrl ?? "").replace(/\/+$/, "")}/mcp`;
  const listed = connections.data;

  const revokeOne = (connectionId: string) => {
    const remaining = (listed ?? []).filter((each) => each.id !== connectionId).length;
    revoke.mutate(connectionId);
    requestAnimationFrame(() => (remaining > 0 ? connectedLabel.current : setupLabel.current)?.focus());
  };

  return (
    <>
      <p className={styles.intro} data-testid={connectionsSectionTestIds.intro}>
        {CONNECTIONS_INTRO}
      </p>
      {revoke.isError && (
        <p className={styles.error} role="alert" data-testid={connectionsSectionTestIds.error}>
          <StrokeIcon name="alertCircle" size={14} />
          That assistant couldn't be revoked. Try again.
        </p>
      )}
      {connections.isError ? (
        <p className={styles.error} role="alert" data-testid={connectionsSectionTestIds.error}>
          <StrokeIcon name="alertCircle" size={14} />
          Your connections couldn't be loaded.{" "}
          <button type="button" className={styles.retry} onClick={() => {
            analytics.mcp.settingsConnections.retried();
            void connections.refetch();
          }}>
            Try again
          </button>
        </p>
      ) : listed === undefined ? (
        <div className={styles.pending} aria-busy="true" data-testid={connectionsSectionTestIds.pending} />
      ) : listed.length > 0 ? (
        <>
          <div className={styles.card} data-testid={connectionsSectionTestIds.connected}>
            <p
              className={styles.label}
              ref={connectedLabel}
              tabIndex={-1}
              data-testid={connectionsSectionTestIds.connectedLabel}
            >
              Connected
            </p>
            <ul className={styles.list}>
              {listed.map((each) => (
                <ConnectionRow key={each.id} connection={each} now={now} onRevoke={revokeOne} />
              ))}
            </ul>
          </div>
          <ConnectorSetup label="Connect another" address={address} ref={setupLabel} />
        </>
      ) : (
        <>
          <ConnectorSetup label="Connect an assistant" address={address} ref={setupLabel} />
          <div className={styles.card} data-testid={connectionsSectionTestIds.tryAsking}>
            <p className={styles.label}>Try asking</p>
            <ExampleQuestions />
          </div>
        </>
      )}
    </>
  );
}
