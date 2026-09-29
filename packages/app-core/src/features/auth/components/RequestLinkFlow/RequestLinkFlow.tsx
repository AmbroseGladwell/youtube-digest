import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { MAGIC_LINK_TTL_MINUTES, type AuthIntent } from "@overview/domain";
import { useDefaultApiUrl } from "../../../../app/DefaultApiUrlContext.js";
import { useIsPanel } from "../../../../app/LayoutContext.js";
import { Routes } from "../../../../app/Routes.js";
import { useSurface } from "../../../../app/SurfaceContext.js";
import { ErrorState } from "../../../../components/shared/ErrorState/ErrorState.js";
import { useIsPhone } from "../../../../util/useIsPhone.js";
import { useOverviewsWithStateQuery } from "../../../overviews/queries/overviewsWithStateQuery.js";
import { useSync } from "../../../sync/SyncContext.js";
import { useSyncConnection } from "../../../sync/useSyncConnection.js";
import { useExchangeLinkCodeMutation } from "../../mutations/useExchangeLinkCodeMutation.js";
import { useRequestMagicLinkMutation } from "../../mutations/useRequestMagicLinkMutation.js";
import type { PendingSignIn } from "../../types/PendingSignIn.js";
import { usePendingSignIn } from "../../usePendingSignIn.js";
import { authFailureMessage, CODE_SPENT, LINK_SPENT } from "../../util/authFailureMessage.js";
import { savedOverviewsNote } from "../../util/savedOverviewsNote.js";
import { AuthScreen } from "../AuthScreen/AuthScreen.js";
import { CheckEmail } from "../CheckEmail/CheckEmail.js";
import { EmailLinkForm, type EmailLinkFormValues } from "../EmailLinkForm/EmailLinkForm.js";
import { EnterCode } from "../EnterCode/EnterCode.js";
import { SignedInWelcome } from "../SignedInWelcome/SignedInWelcome.js";
import { requestLinkFlowTestIds } from "./RequestLinkFlowTestIds.js";

export interface RequestLinkFlowProps {
  intent: AuthIntent;
  expired?: boolean;
}

// Asking for a link, then waiting for it: design 9a–9e and 9h on the web, 10b–10e in the
// extension, where the wait is for a code and outlives the panel being closed
// (docs/features/sign-in.md).
export function RequestLinkFlow({ intent, expired = false }: RequestLinkFlowProps) {
  const surface = useSurface();
  const isPanel = useIsPanel();
  const isPhone = useIsPhone();
  const navigate = useNavigate();
  const sync = useSync();
  const defaultApiUrl = useDefaultApiUrl();
  const { connection, setConnection } = useSyncConnection();
  const { pending, setPending } = usePendingSignIn();
  const [sentHere, setSentHere] = useState<PendingSignIn | null>(null);
  const [lastEmail, setLastEmail] = useState("");
  const [welcomeName, setWelcomeName] = useState<string | null | undefined>(undefined);
  const [refused, setRefused] = useState<string | null>(null);
  const [codeRefused, setCodeRefused] = useState<string | null>(null);
  const requestLink = useRequestMagicLinkMutation();
  const exchangeCode = useExchangeLinkCodeMutation();
  const library = useOverviewsWithStateQuery();
  const overviewCount = library.data?.filter((entry) => entry.kind === "overview").length ?? 0;

  const inExtension = surface === "extension";
  const sent = inExtension ? pending : sentHere;
  const setSent = inExtension ? setPending : setSentHere;
  const knownServer = inExtension ? (connection.apiUrl ?? defaultApiUrl) : (globalThis.location?.origin ?? null);

  if (!sync.available) {
    return <ErrorState title="Accounts need the web app or the extension" back />;
  }

  if (welcomeName !== undefined) {
    return (
      <SignedInWelcome
        firstName={welcomeName}
        overviewCount={overviewCount}
        onDone={() => void navigate(Routes.home(), { replace: true })}
      />
    );
  }

  if (sync.connected) {
    return <Navigate to={Routes.home()} replace />;
  }

  const ask = (apiUrl: string, email: string, askedIntent: AuthIntent, firstName: string | null) => {
    setRefused(null);
    requestLink.mutate(
      {
        apiUrl,
        request: { email, surface, intent: askedIntent, ...(firstName === null ? {} : { firstName }) },
      },
      {
        onSuccess: () => {
          setCodeRefused(null);
          setSent({ apiUrl, email, intent: askedIntent, firstName, sentAt: Date.now() });
        },
        onError: (error) => setRefused(authFailureMessage(error, LINK_SPENT)),
      },
    );
  };

  const startOver = () => {
    setLastEmail(sent?.email ?? "");
    requestLink.reset();
    exchangeCode.reset();
    setCodeRefused(null);
    setSent(null);
  };

  if (sent !== null) {
    const resend = () => ask(sent.apiUrl, sent.email, sent.intent, sent.firstName);
    if (inExtension) {
      return (
        <EnterCode
          email={sent.email}
          sentAt={sent.sentAt}
          connecting={exchangeCode.isPending}
          resending={requestLink.isPending}
          refused={codeRefused}
          onDifferentEmail={startOver}
          onResend={resend}
          onConnect={(code) => {
            setCodeRefused(null);
            exchangeCode.mutate(
              { apiUrl: sent.apiUrl, code },
              {
                onSuccess: (linked) => {
                  setWelcomeName(linked.firstName);
                  setConnection({
                    apiUrl: sent.apiUrl,
                    token: linked.token,
                    email: linked.email,
                    firstName: linked.firstName,
                  });
                  setPending(null);
                },
                onError: (error) => setCodeRefused(authFailureMessage(error, CODE_SPENT)),
              },
            );
          }}
        />
      );
    }
    return (
      <CheckEmail
        email={sent.email}
        intent={sent.intent}
        firstName={sent.firstName}
        sentAt={sent.sentAt}
        resending={requestLink.isPending}
        onDifferentEmail={startOver}
        onResend={resend}
      />
    );
  }

  const creating = intent === "createAccount";
  const here = isPhone ? "this phone" : "this device";
  const lead = expired
    ? `Sign-in links work once, for ${MAGIC_LINK_TTL_MINUTES} minutes. Ask for a new one and use it straight away.`
    : inExtension
      ? creating
        ? "We'll email you a link. Open it in this browser for a code to type in here."
        : "We'll email you a link. Open it in this browser and it shows a code to type in here."
      : creating
        ? "We'll email you a link to confirm it's you. There's no password."
        : `We'll email you a link. Open it on ${here} and you're in. There's no password.`;
  const place = inExtension ? "extension" : isPhone ? "phone" : "browser";
  const shortSwitch = isPanel || isPhone;

  return (
    <AuthScreen
      testId={requestLinkFlowTestIds.root}
      title={expired ? "That link has expired" : creating ? "Create your account" : "Sign in"}
      lead={lead}
    >
      <EmailLinkForm
        intent={intent}
        submitLabel={expired ? "Email me a new link" : creating ? "Create account" : "Email me a link"}
        initialEmail={lastEmail}
        askForServer={inExtension ? (knownServer === null ? "always" : "onRequest") : "never"}
        initialServerUrl={knownServer}
        note={expired ? null : savedOverviewsNote(overviewCount, intent, place)}
        switchLink={
          expired ? undefined : creating ? (
            <>
              {shortSwitch ? "Have an account?" : "Already have an account?"}{" "}
              <Link to={Routes.signIn()} replace data-testid={requestLinkFlowTestIds.switchLink}>
                Sign in
              </Link>
            </>
          ) : (
            <>
              New here?{" "}
              <Link to={Routes.createAccount()} replace data-testid={requestLinkFlowTestIds.switchLink}>
                Create an account
              </Link>
            </>
          )
        }
        sending={requestLink.isPending}
        refused={refused}
        onSubmit={({ email, firstName, serverUrl }: EmailLinkFormValues) => {
          const apiUrl = serverUrl ?? knownServer;
          if (apiUrl !== null) ask(apiUrl, email, intent, firstName);
        }}
      />
    </AuthScreen>
  );
}
