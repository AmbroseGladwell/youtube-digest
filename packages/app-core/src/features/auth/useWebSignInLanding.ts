import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import type { SignedIn } from "@overview/domain";
import type { ConsentPageLocationState } from "../connections/ConsentPage/ConsentPage.js";
import { useLibraryAccountId } from "../../stores/LibraryAccountContext.js";
import { useSharedPageIntent } from "../sharedPage/useSharedPageIntent.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";

type WebSignedIn = Extract<SignedIn, { surface: "web" }>;

// A browser the server has just signed in, by a link or by the code from its mail: this
// device connects to the account, and the page lands once the account's library is the one
// open, so whatever the visitor started goes into it rather than the library being left
// (docs/features/sign-in.md, docs/features/account-libraries.md).
export function useWebSignInLanding() {
  const navigate = useNavigate();
  const { setConnection } = useSyncConnection();
  const finishSharedPageIntent = useSharedPageIntent();
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
    // Whatever the visitor was doing on a shared page is finished either way; a link that
    // names where to come back to still decides where they land
    // (docs/features/sharing.md, docs/features/mcp-connector.md).
    void finishSharedPageIntent().then((afterIntent) =>
      returnTo === null ? navigate(afterIntent, { replace: true }) : navigate(returnTo, { replace: true, state }),
    );
  }, [landing, libraryAccountId, finishSharedPageIntent, navigate]);

  return { land, landing: landing !== null };
}
