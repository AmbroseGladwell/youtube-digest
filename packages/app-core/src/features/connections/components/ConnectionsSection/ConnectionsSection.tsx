import { useRef } from "react";
import { useLocation } from "react-router";
import { connectionAssistant, FOLLOW_UP_ASSISTANTS, type ChosenAssistant } from "@overview/domain";
import { isSyncRequestError } from "@overview/sync";
import { Routes } from "../../../../app/Routes.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useSessionQuery } from "../../../auth/queries/sessionQuery.js";
import { useSync } from "../../../sync/SyncContext.js";
import { useSyncConnection } from "../../../sync/useSyncConnection.js";
import { useRevokeConnectionMutation } from "../../mutations/useRevokeConnectionMutation.js";
import { useConnectionsQuery } from "../../queries/connectionsQuery.js";
import { useSettingsQuery } from "../../../settings/queries/settingsQuery.js";
import { ConnectionRow } from "../ConnectionRow/ConnectionRow.js";
import { ConnectorSetup } from "../ConnectorSetup/ConnectorSetup.js";
import { CONNECTOR_ICON_PATH } from "../../util/connectorSteps.js";
import { ExampleQuestions } from "../ExampleQuestions/ExampleQuestions.js";
import { QuestionsPlacePicker } from "../QuestionsPlacePicker/QuestionsPlacePicker.js";
import styles from "./ConnectionsSection.module.scss";
import { connectionsSectionTestIds } from "./ConnectionsSectionTestIds.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { PageLink } from "../../../../components/shared/PageLink/PageLink.js";

export const CONNECTIONS_INTRO =
  "Let Claude or another assistant read your overviews and transcripts, so you can ask about everything you’ve saved, mark them read or favourite for you, and gather them into projects.";

// Design 301f: arriving from a question's "Set up a connection", what happens next, until the
// assistant questions open in is connected.
function arrivalNote(chosen: ChosenAssistant | null): string {
  if (chosen === null || chosen === "other") {
    return "Pick your assistant and connect it, then go back to your question.";
  }
  const { name } = FOLLOW_UP_ASSISTANTS[chosen];
  return `Connect ${name}, then go back to your question. It’ll open in ${name}, connected.`;
}

// Design 58i–58r. A connection belongs to an account rather than to a plan
// (docs/architecture/tiers.md), so signed out is the only state that says what it would take
// rather than showing controls that cannot work.
export function ConnectionsSection() {
  const analytics = useAnalytics();
  const sync = useSync();
  const { connection } = useSyncConnection();
  const session = useSessionQuery();
  const connections = useConnectionsQuery();
  const revoke = useRevokeConnectionMutation();
  const settings = useSettingsQuery().data;
  const sharingProfile = settings?.shareProfileWithAssistants ?? true;
  const fromQuestion = (useLocation().state as { fromQuestion?: boolean } | null)?.fromQuestion === true;
  const connectedLabel = useRef<HTMLParagraphElement>(null);
  const setupLabel = useRef<HTMLParagraphElement>(null);
  const now = new Date();

  const sessionEnded = isSyncRequestError(session.error) && session.error.code === "unauthenticated";

  if (!sync.connected || sessionEnded) {
    return (
      <div className={styles.card} data-testid={connectionsSectionTestIds.signInFirst}>
        <p className={styles.label}>Sign in first</p>
        <p className={styles.body}>
          A connection belongs to your account, not to this browser. Sign in, then connect an assistant from here or from the web app.
        </p>
        <div className={styles.actions}>
          <PageLink
            to={Routes.signIn()}
            className={styles.primary}
            onClick={() => analytics.mcp.settingsConnections.signInChosen()}
            data-testid={connectionsSectionTestIds.signInLink}
          >
            Sign in
          </PageLink>
          <PageLink
            to={Routes.createAccount()}
            className={styles.secondary}
            onClick={() => analytics.mcp.settingsConnections.createAccountChosen()}
            data-testid={connectionsSectionTestIds.createAccountLink}
          >
            Create account
          </PageLink>
        </div>
      </div>
    );
  }

  if (session.isError) {
    return (
      <p className={styles.error} role="alert" data-testid={connectionsSectionTestIds.error}>
        <StrokeIcon name="alertCircle" size={14} />
        Your account couldn't be checked.{" "}
        <button
          type="button"
          className={styles.retry}
          onClick={() => {
            analytics.mcp.settingsConnections.retried();
            void session.refetch();
          }}
        >
          Try again
        </button>
      </p>
    );
  }

  if (session.data === undefined) {
    return <div className={styles.pending} aria-busy="true" data-testid={connectionsSectionTestIds.pending} />;
  }

  const server = (connection.apiUrl ?? "").replace(/\/+$/, "");
  const address = `${server}/mcp`;
  const iconUrl = `${server}${CONNECTOR_ICON_PATH}`;
  const chosen = settings?.followUpAssistant ?? null;
  const chosenConnected = chosen !== null && (connections.data ?? []).some((each) => connectionAssistant(each.clientName) === chosen);
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
      {fromQuestion && !chosenConnected && (
        <p className={styles.fromQuestion} role="status" data-testid={connectionsSectionTestIds.fromQuestion}>
          {arrivalNote(chosen)}
        </p>
      )}
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
          <button
            type="button"
            className={styles.retry}
            onClick={() => {
              analytics.mcp.settingsConnections.retried();
              void connections.refetch();
            }}
          >
            Try again
          </button>
        </p>
      ) : listed === undefined ? (
        <div className={styles.pending} aria-busy="true" data-testid={connectionsSectionTestIds.pending} />
      ) : listed.length > 0 ? (
        <>
          <div className={styles.card} data-testid={connectionsSectionTestIds.connected}>
            <p className={styles.label} ref={connectedLabel} tabIndex={-1} data-testid={connectionsSectionTestIds.connectedLabel}>
              Connected
            </p>
            <ul className={styles.list}>
              {listed.map((each) => (
                <ConnectionRow key={each.id} connection={each} now={now} sharingProfile={sharingProfile} onRevoke={revokeOne} />
              ))}
            </ul>
          </div>
          <ConnectorSetup label="Connect another" address={address} iconUrl={iconUrl} ref={setupLabel} />
          <QuestionsPlacePicker />
        </>
      ) : (
        <>
          <ConnectorSetup label="Connect an assistant" address={address} iconUrl={iconUrl} ref={setupLabel} />
          <div className={styles.card} data-testid={connectionsSectionTestIds.tryAsking}>
            <p className={styles.label}>Try asking</p>
            <ExampleQuestions />
          </div>
          <QuestionsPlacePicker />
        </>
      )}
    </>
  );
}
