import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { signInReturnFromSearch, signInTokenFromHash } from "@overview/domain";
import { isSyncRequestError } from "@overview/sync";
import type { ConsentPageLocationState } from "../../connections/ConsentPage/ConsentPage.js";
import { ErrorState } from "../../../components/shared/ErrorState/ErrorState.js";
import { Routes } from "../../../app/Routes.js";
import { useLibraryAccountId } from "../../../stores/LibraryAccountContext.js";
import { useSharedPageIntent } from "../../sharedPage/useSharedPageIntent.js";
import { useSyncConnection } from "../../sync/useSyncConnection.js";
import { AuthScreen } from "../components/AuthScreen/AuthScreen.js";
import { LinkCodeCard } from "../components/LinkCodeCard/LinkCodeCard.js";
import { RequestLinkFlow } from "../components/RequestLinkFlow/RequestLinkFlow.js";
import { useSignInMutation } from "../mutations/useSignInMutation.js";
import { authFailureMessage, LINK_SPENT } from "../util/authFailureMessage.js";
import styles from "./SignInPage.module.scss";
import { signInPageTestIds } from "./SignInPageTestIds.js";

// /sign-in is both where the bar's Sign in goes and where a magic link lands, so asking,
// waiting, being signed in and a spent link all live at one address. A link's token is
// spent by one POST to this page's origin: a web link signs this browser in and goes to
// the library; an extension link shows the code and signs nothing in here
// (docs/features/sign-in.md).
export function SignInPage() {
  const { hash, search } = useLocation();
  const navigate = useNavigate();
  const { setConnection } = useSyncConnection();
  const signIn = useSignInMutation();
  const finishSharedPageIntent = useSharedPageIntent();
  const token = signInTokenFromHash(hash);
  const apiUrl = globalThis.location?.origin ?? "";
  const started = useRef<string | null>(null);
  const libraryAccountId = useLibraryAccountId();
  const [landing, setLanding] = useState<{ accountId: string; returnTo: string | null } | null>(null);

  useEffect(() => {
    if (token === null || started.current === token) return;
    started.current = token;
    signIn.mutate(
      { apiUrl, token },
      {
        onSuccess: (signedIn) => {
          if (signedIn.surface === "web") {
            setConnection({
              apiUrl,
              token: null,
              accountId: signedIn.accountId,
              email: signedIn.email,
              firstName: signedIn.firstName,
            });
            setLanding({ accountId: signedIn.accountId, returnTo: signInReturnFromSearch(search) });
          }
        },
      },
    );
  }, [token, search, apiUrl, signIn, setConnection]);

  // Landing waits for the account's library to be the one open, so whatever the visitor
  // started goes into it rather than the library being left (docs/features/account-libraries.md).
  useEffect(() => {
    if (landing === null || libraryAccountId !== landing.accountId) return;
    setLanding(null);
    const { returnTo } = landing;
    const state: ConsentPageLocationState = { fromSignInLink: true };
    // Whatever the visitor was doing on a shared page is finished either way; a link that
    // names where to come back to still decides where they land
    // (docs/features/sharing.md, docs/features/mcp-connector.md).
    void finishSharedPageIntent().then((afterIntent) =>
      returnTo === null ? navigate(afterIntent, { replace: true }) : navigate(returnTo, { replace: true, state }),
    );
  }, [landing, libraryAccountId, finishSharedPageIntent, navigate]);

  if (token === null) {
    return <RequestLinkFlow intent="signIn" returnTo={signInReturnFromSearch(search)} />;
  }

  if (signIn.isError) {
    if (isSyncRequestError(signIn.error) && signIn.error.code === "link_invalid") {
      return <RequestLinkFlow intent="signIn" expired returnTo={signInReturnFromSearch(search)} />;
    }
    return (
      <ErrorState screen="signInLinkFailed"
        title="That link didn't sign you in"
        error={signIn.error}
        body={authFailureMessage(signIn.error, LINK_SPENT)}
        action={{ label: "Try again", onSelect: () => signIn.mutate({ apiUrl, token }) }}
      />
    );
  }

  if (signIn.isSuccess && signIn.data.surface === "extension") {
    return <LinkCodeCard code={signIn.data.linkCode} from="emailLink" />;
  }

  return (
    <AuthScreen testId={signInPageTestIds.working} title="Signing you in…">
      <div className={styles.progress} role="progressbar" aria-label="Signing you in">
        <div className={styles.progressFill} />
      </div>
      <p className={styles.note}>Checking your link. This takes a moment.</p>
    </AuthScreen>
  );
}
