import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { signInTokenFromHash } from "@overview/domain";
import { ErrorState } from "../../../components/shared/ErrorState/ErrorState.js";
import { Routes } from "../../../app/Routes.js";
import { useSyncConnection } from "../../sync/useSyncConnection.js";
import { useSignInMutation } from "../mutations/useSignInMutation.js";
import { authFailureMessage, LINK_SPENT } from "../util/authFailureMessage.js";
import styles from "./SignInPage.module.scss";
import { signInPageTestIds } from "./SignInPageTestIds.js";

// Where a magic link lands. The token is in the page's own hash and is spent by one POST
// to this page's origin, which is the API's. A web link leaves this browser signed in
// and goes to Settings; an extension link shows the code the panel is waiting for and
// signs nothing in here (docs/features/sign-in.md).
export function SignInPage() {
  const { hash } = useLocation();
  const navigate = useNavigate();
  const { setConnection } = useSyncConnection();
  const signIn = useSignInMutation();
  const token = signInTokenFromHash(hash);
  const apiUrl = globalThis.location?.origin ?? "";
  const started = useRef(false);

  useEffect(() => {
    if (token === null || started.current) return;
    started.current = true;
    signIn.mutate(
      { apiUrl, token },
      {
        onSuccess: (signedIn) => {
          if (signedIn.surface === "web") {
            setConnection({ apiUrl, token: null, email: signedIn.email });
            void navigate(Routes.settings(), { replace: true });
          }
        },
      },
    );
  }, [token, apiUrl, signIn, setConnection, navigate]);

  if (token === null) {
    return (
      <ErrorState
        title="There's no sign-in link here"
        body="Open the link from your email, or ask for a new one from Settings."
        action={{ label: "Go to Settings", onSelect: () => void navigate(Routes.settings()) }}
      />
    );
  }

  if (signIn.isError) {
    return (
      <ErrorState
        title="That link didn't sign you in"
        body={authFailureMessage(signIn.error, `${LINK_SPENT} Ask for a new one from Settings.`)}
        action={{ label: "Go to Settings", onSelect: () => void navigate(Routes.settings()) }}
      />
    );
  }

  if (signIn.isSuccess && signIn.data.surface === "extension") {
    return (
      <div className={styles.root} data-testid={signInPageTestIds.root}>
        <h2 className={styles.title}>Enter this code in the extension</h2>
        <p className={styles.code} data-testid={signInPageTestIds.linkCode}>
          {signIn.data.linkCode}
        </p>
        <p className={styles.body} data-testid={signInPageTestIds.linkCodeNote}>
          It works once, for the next ten minutes, in the extension's Settings. This browser tab
          has not been signed in: the extension asked, so the extension is what signs in.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.root} data-testid={signInPageTestIds.root}>
      <p className={styles.body} data-testid={signInPageTestIds.working}>
        Signing you in…
      </p>
    </div>
  );
}
