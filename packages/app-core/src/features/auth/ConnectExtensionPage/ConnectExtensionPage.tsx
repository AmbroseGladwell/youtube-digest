import { useEffect, useRef } from "react";
import { Navigate } from "react-router";
import { isSyncRequestError } from "@overview/sync";
import { Routes } from "../../../app/Routes.js";
import { useSurface } from "../../../app/SurfaceContext.js";
import { ErrorState } from "../../../components/shared/ErrorState/ErrorState.js";
import { useSync } from "../../sync/SyncContext.js";
import { useSyncConnection } from "../../sync/useSyncConnection.js";
import { AuthScreen } from "../components/AuthScreen/AuthScreen.js";
import { LinkCodeCard } from "../components/LinkCodeCard/LinkCodeCard.js";
import { useIssueLinkCodeMutation } from "../mutations/useIssueLinkCodeMutation.js";
import { authFailureMessage, CODE_SPENT } from "../util/authFailureMessage.js";
import { connectExtensionPageTestIds } from "./ConnectExtensionPageTestIds.js";

// The web app, already signed in, mints a code over its own session so the extension
// beside it signs in without a second email (docs/features/sign-in.md).
export function ConnectExtensionPage() {
  const surface = useSurface();
  const sync = useSync();
  const { connection } = useSyncConnection();
  const issue = useIssueLinkCodeMutation();
  const apiUrl = connection.apiUrl ?? globalThis.location?.origin ?? "";
  const canIssue = surface === "web" && sync.connected && sync.status.phase !== "signedOut";
  const started = useRef(false);

  useEffect(() => {
    if (!canIssue || started.current) return;
    started.current = true;
    issue.mutate({ apiUrl });
  }, [canIssue, apiUrl, issue]);

  if (surface !== "web") {
    return <Navigate to={Routes.home()} replace />;
  }

  if (!canIssue) {
    return <Navigate to={Routes.signIn()} replace />;
  }

  if (issue.isError) {
    return (
      <ErrorState
        title="Couldn't make a code for the extension"
        body={
          isSyncRequestError(issue.error) && issue.error.code === "unauthenticated"
            ? "This browser's session has ended. Sign in again, then try once more."
            : authFailureMessage(issue.error, CODE_SPENT)
        }
        action={{ label: "Try again", onSelect: () => issue.mutate({ apiUrl }) }}
      />
    );
  }

  if (issue.isSuccess) {
    return <LinkCodeCard code={issue.data.linkCode} from="webApp" onNewCode={() => issue.mutate({ apiUrl })} />;
  }

  return (
    <AuthScreen
      testId={connectExtensionPageTestIds.working}
      icon="puzzle"
      title="Making your code…"
      compactTitle
    />
  );
}
