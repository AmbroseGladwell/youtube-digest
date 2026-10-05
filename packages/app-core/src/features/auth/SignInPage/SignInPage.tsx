import { useEffect, useRef } from "react";
import { useLocation } from "react-router";
import { signInReturnFromSearch, signInTokenFromHash } from "@overview/domain";
import { isSyncRequestError } from "@overview/sync";
import { ErrorState } from "../../../components/shared/ErrorState/ErrorState.js";
import { AuthScreen } from "../components/AuthScreen/AuthScreen.js";
import { LinkCodeCard } from "../components/LinkCodeCard/LinkCodeCard.js";
import { RequestLinkFlow } from "../components/RequestLinkFlow/RequestLinkFlow.js";
import { useSignInMutation } from "../mutations/useSignInMutation.js";
import { useWebSignInLanding } from "../useWebSignInLanding.js";
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
  const signIn = useSignInMutation();
  const { land } = useWebSignInLanding();
  const token = signInTokenFromHash(hash);
  const apiUrl = globalThis.location?.origin ?? "";
  const started = useRef<string | null>(null);

  useEffect(() => {
    if (token === null || started.current === token) return;
    started.current = token;
    signIn.mutate(
      { apiUrl, token },
      {
        onSuccess: (signedIn) => {
          if (signedIn.surface === "web") land(apiUrl, signedIn, signInReturnFromSearch(search));
        },
      },
    );
  }, [token, search, apiUrl, signIn, land]);

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
