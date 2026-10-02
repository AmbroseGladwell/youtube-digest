import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { MAGIC_LINK_TTL_MINUTES, type AuthIntent } from "@overview/domain";
import { useIsPanel } from "../../../../app/LayoutContext.js";
import { Routes } from "../../../../app/Routes.js";
import { useSurface } from "../../../../app/SurfaceContext.js";
import { ErrorState } from "../../../../components/shared/ErrorState/ErrorState.js";
import { useIsPhone } from "../../../../util/useIsPhone.js";
import { useOverviewsWithStateQuery } from "../../../overviews/queries/overviewsWithStateQuery.js";
import { SharedPageIntentCard } from "../../../sharedPage/components/SharedPageIntentCard/SharedPageIntentCard.js";
import { useSync } from "../../../sync/SyncContext.js";
import { useKnownApiUrl } from "../../../sync/useKnownApiUrl.js";
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
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";

export interface RequestLinkFlowProps {
  intent: AuthIntent;
  expired?: boolean;
  // Where a web link should land once it has signed in: a consent screen whose link
  // expired is asked for again without losing the request (docs/features/sign-in.md).
  returnTo?: string | null;
}

// Asking for a link, then waiting for it: design 9a–9e and 9h on the web, 10b–10e in the
// extension, where the wait is for a code and outlives the panel being closed
// (docs/features/sign-in.md).
export function RequestLinkFlow({ intent, expired = false, returnTo = null }: RequestLinkFlowProps) {
  const surface = useSurface();
  const isPanel = useIsPanel();
  const isPhone = useIsPhone();
  const navigate = useNavigate();
  const sync = useSync();
  const knownServer = useKnownApiUrl();
  const { setConnection } = useSyncConnection();
  const { pending, setPending } = usePendingSignIn();
  const [sentHere, setSentHere] = useState<PendingSignIn | null>(null);
  const [lastEmail, setLastEmail] = useState("");
  const [welcomeName, setWelcomeName] = useState<string | null | undefined>(undefined);
  const [refused, setRefused] = useState<string | null>(null);
  const [codeRefused, setCodeRefused] = useState<string | null>(null);
  const [codeFromWebApp, setCodeFromWebApp] = useState(false);
  const requestLink = useRequestMagicLinkMutation();
  const exchangeCode = useExchangeLinkCodeMutation();
  const library = useOverviewsWithStateQuery();
  const overviewCount = library.data?.filter((entry) => entry.kind === "overview").length ?? 0;

  const inExtension = surface === "extension";
  const sent = inExtension ? pending : sentHere;
  const setSent = inExtension ? setPending : setSentHere;

  const analytics = useAnalytics();

  if (!sync.available) {
    return <ErrorState screen="accountsUnavailable" title="Accounts need the web app or the extension" back />;
  }

  if (welcomeName !== undefined) {
    return (
      <SignedInWelcome
        firstName={welcomeName}
        overviewCount={overviewCount}
        onDone={() => {
          analytics.account.signIn.welcomeDone();
          void navigate(Routes.home(), { replace: true });
        }}
      />
    );
  }

  if (sync.connected) {
    return <Navigate to={Routes.home()} replace />;
  }

  const ask = (apiUrl: string, email: string, askedIntent: AuthIntent, firstName: string | null, resend: boolean) => {
    analytics.account.signIn.linkRequested({ intent: askedIntent, from: "signInPage", resend });
    setRefused(null);
    requestLink.mutate(
      {
        apiUrl,
        request: {
          email,
          surface,
          intent: askedIntent,
          ...(firstName === null ? {} : { firstName }),
          ...(returnTo === null || inExtension ? {} : { returnTo }),
        },
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

  const connectWithCode = (apiUrl: string, code: string) => {
    setCodeRefused(null);
    exchangeCode.mutate(
      { apiUrl, code },
      {
        onSuccess: (linked) => {
          setWelcomeName(linked.firstName);
          setConnection({ apiUrl, token: linked.token, email: linked.email, firstName: linked.firstName });
          setPending(null);
        },
        onError: (error) => setCodeRefused(authFailureMessage(error, CODE_SPENT)),
      },
    );
  };

  const startOver = () => {
    analytics.account.signIn.differentEmailChosen({ from: inExtension ? "enterCode" : "checkEmail" });
    setLastEmail(sent?.email ?? "");
    requestLink.reset();
    exchangeCode.reset();
    setCodeRefused(null);
    setSent(null);
  };

  if (sent !== null) {
    const resend = () => ask(sent.apiUrl, sent.email, sent.intent, sent.firstName, true);
    if (inExtension) {
      return (
        <EnterCode
          key="emailLink"
          from="emailLink"
          email={sent.email}
          sentAt={sent.sentAt}
          connecting={exchangeCode.isPending}
          resending={requestLink.isPending}
          refused={codeRefused}
          onDifferentEmail={startOver}
          onResend={resend}
          onConnect={(code) => connectWithCode(sent.apiUrl, code)}
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

  const offersWebAppCode = inExtension && intent === "signIn" && !expired;
  if (offersWebAppCode && codeFromWebApp) {
    return (
      <EnterCode
        key="webApp"
        from="webApp"
        connecting={exchangeCode.isPending}
        refused={codeRefused}
        onEmailInstead={() => {
          analytics.account.signIn.emailInsteadChosen();
          exchangeCode.reset();
          setCodeRefused(null);
          setCodeFromWebApp(false);
        }}
        initialServerUrl={knownServer}
        onConnect={(code, serverUrl) => {
          const apiUrl = serverUrl ?? knownServer;
          if (apiUrl !== null) connectWithCode(apiUrl, code);
        }}
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
      <SharedPageIntentCard />
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
              <Link
                to={Routes.signIn()}
                replace
                onClick={() => analytics.account.signIn.switchChosen({ to: "signIn" })}
                data-testid={requestLinkFlowTestIds.switchLink}
              >
                Sign in
              </Link>
            </>
          ) : (
            <>
              New here?{" "}
              <Link
                to={Routes.createAccount()}
                replace
                onClick={() => analytics.account.signIn.switchChosen({ to: "createAccount" })}
                data-testid={requestLinkFlowTestIds.switchLink}
              >
                Create an account
              </Link>
              {offersWebAppCode && (
                <>
                  <br />
                  Signed in on the web app?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      analytics.account.signIn.webAppCodeChosen();
                      setCodeFromWebApp(true);
                    }}
                    data-testid={requestLinkFlowTestIds.webAppCodeButton}
                  >
                    Enter a code
                  </button>
                </>
              )}
            </>
          )
        }
        sending={requestLink.isPending}
        refused={refused}
        onSubmit={({ email, firstName, serverUrl }: EmailLinkFormValues) => {
          const apiUrl = serverUrl ?? knownServer;
          if (apiUrl !== null) ask(apiUrl, email, intent, firstName, false);
        }}
      />
    </AuthScreen>
  );
}
