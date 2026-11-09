import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { EmailChangeRevertRefusal, revertTokenFromHash, type EmailChangeRevertRefusal as Refusal } from "@overview/domain";
import { isSyncRequestError } from "@overview/sync";
import { Routes } from "../../../app/Routes.js";
import { ErrorState } from "../../../components/shared/ErrorState/ErrorState.js";
import { useAnalytics } from "../../analytics/AnalyticsContext.js";
import { useSignOut } from "../../accountLibraries/useSignOut.js";
import { legalIdentity } from "../../legal/legalIdentity.js";
import { useSync } from "../../sync/SyncContext.js";
import { AuthScreen } from "../components/AuthScreen/AuthScreen.js";
import { useRevertEmailChangeMutation } from "../mutations/useRevertEmailChangeMutation.js";
import { authFailureMessage } from "../util/authFailureMessage.js";
import styles from "./RevertEmailPage.module.scss";
import { revertEmailPageTestIds } from "./RevertEmailPageTestIds.js";

const refusalReason = (details: Record<string, unknown> | undefined): { reason: Refusal; email: string | null } => {
  const parsed = EmailChangeRevertRefusal.safeParse(details?.reason);
  return {
    reason: parsed.success ? parsed.data : "spent",
    email: typeof details?.email === "string" ? details.email : null,
  };
};

const refusedLead = (reason: Refusal, email: string | null): string => {
  switch (reason) {
    case "expired":
      return "It was valid for seven days after the change, and those seven days have passed.";
    case "taken":
      return `${email ?? "That address"} now belongs to another account, so this one can’t move back to it.`;
    case "spent":
      return "It has already been used, or the account’s email has changed again since.";
  }
};

// Design 14j: where the old address's "This wasn't me" button lands. The token is spent by
// a POST from this page, as a sign-in link's is. Done means every session on the account
// has ended, this browser's included, so Sign in is the one action
// (docs/features/account-changes.md, "Moving it back").
export function RevertEmailPage() {
  const { hash } = useLocation();
  const navigate = useNavigate();
  const sync = useSync();
  const signOut = useSignOut();
  const analytics = useAnalytics();
  const revert = useRevertEmailChangeMutation();
  const token = revertTokenFromHash(hash);
  const apiUrl = globalThis.location?.origin ?? "";
  const started = useRef<string | null>(null);

  useEffect(() => {
    if (token === null || started.current === token) return;
    started.current = token;
    revert.mutate(
      { apiUrl, token },
      {
        onSuccess: () => analytics.account.revertPage.used(),
        onError: (error) => {
          if (isSyncRequestError(error) && error.code === "link_invalid") {
            analytics.account.revertPage.refused({ reason: refusalReason(error.details).reason });
          }
        },
      },
    );
  }, [token, apiUrl, revert, analytics]);

  const help = (
    <p className={styles.help}>
      Write to{" "}
      <a className={styles.helpLink} href={`mailto:${legalIdentity.contactEmail}`}>
        {legalIdentity.contactEmail}
      </a>{" "}
      and we’ll help you get the account back.
    </p>
  );

  if (token === null || (revert.isError && isSyncRequestError(revert.error) && revert.error.code === "link_invalid")) {
    const { reason, email } =
      token === null
        ? { reason: "spent" as const, email: null }
        : refusalReason((revert.error as { details?: Record<string, unknown> }).details);
    return (
      <AuthScreen
        testId={revertEmailPageTestIds.refused}
        title="This link can’t move the account back"
        lead={<span data-testid={revertEmailPageTestIds.reason}>{refusedLead(reason, email)}</span>}
      >
        {help}
      </AuthScreen>
    );
  }

  if (revert.isError) {
    return (
      <ErrorState
        screen="revertEmailFailed"
        title="Couldn’t move the account back"
        error={revert.error}
        body={authFailureMessage(revert.error, "This link can’t move the account back.")}
        action={{ label: "Try again", onSelect: () => revert.mutate({ apiUrl, token }) }}
      />
    );
  }

  if (revert.isSuccess) {
    const signIn = () => {
      void (sync.connected ? signOut() : Promise.resolve()).then(() => navigate(Routes.signIn()));
    };
    return (
      <AuthScreen
        testId={revertEmailPageTestIds.done}
        icon="check"
        title="Your account is moved back"
        lead={
          <>
            Your account signs in with <strong data-testid={revertEmailPageTestIds.email}>{revert.data.email}</strong> again. Every device
            was signed out, including any you didn’t recognise.
          </>
        }
      >
        <p className={styles.note}>Sign in with that address to carry on. Your library is as you left it.</p>
        <button type="button" className={styles.primary} onClick={signIn} data-testid={revertEmailPageTestIds.signInButton}>
          Sign in
        </button>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen testId={revertEmailPageTestIds.working} title="Moving your account back…">
      <div className={styles.progress} role="progressbar" aria-label="Moving your account back">
        <div className={styles.progressFill} />
      </div>
      <p className={styles.note} role="status">
        This takes a moment. Keep this page open.
      </p>
    </AuthScreen>
  );
}
