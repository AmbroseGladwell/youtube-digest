import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import type { SignedIn } from "@overview/domain";
import { Routes } from "../../app/Routes.js";
import type { ConsentPageLocationState } from "../connections/ConsentPage/ConsentPage.js";
import { useLibraryAccountId } from "../../stores/LibraryAccountContext.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";

type WebSignedIn = Extract<SignedIn, { surface: "web" }>;

// A browser the server has just signed in, by a link or by the code from its mail: this
// device connects to the account, and the page lands once the account's library is the one
// open, so whatever comes next, onboarding included, reads the account's library rather than
// the one being left (docs/features/sign-in.md, docs/features/account-libraries.md).
export function useWebSignInLanding() {
  const navigate = useNavigate();
  const { setConnection } = useSyncConnection();
  const libraryAccountId = useLibraryAccountId();
  const [landing, setLanding] = useState<{ accountId: string; returnTo: string | null } | null>(null);

  const land = useCallback(
    (apiUrl: string, signedIn: WebSignedIn, returnTo: string | null) => {
      setConnection({
        apiUrl,
        token: null,
        accountId: signedIn.accountId,
        email: signedIn.email,
        firstName: signedIn.firstName,
      });
      setLanding({ accountId: signedIn.accountId, returnTo });
    },
    [setConnection],
  );

  useEffect(() => {
    if (landing === null || libraryAccountId !== landing.accountId) return;
    setLanding(null);
    const { returnTo } = landing;
    const state: ConsentPageLocationState = { fromSignInLink: true };
    void (returnTo === null ? navigate(Routes.home(), { replace: true }) : navigate(returnTo, { replace: true, state }));
  }, [landing, libraryAccountId, navigate]);

  return { land, landing: landing !== null };
}
