import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import type { SignedIn } from "@overview/domain";
import { Routes } from "../../app/Routes.js";
import type { ConsentPageLocationState } from "../connections/ConsentPage/ConsentPage.js";
import { useLibraryAccountId } from "../../stores/LibraryAccountContext.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";

type WebSignedIn = Extract<SignedIn, { surface: "web" }>;

// Lands once the account's library is open, so what comes next reads it, not the one being left.
export const useWebSignInLanding = () => {
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
    if (landing === null || libraryAccountId !== landing.accountId) {
      return;
    }
    setLanding(null);
    const { returnTo } = landing;
    const state: ConsentPageLocationState = { fromSignInLink: true };
    if (returnTo === null) {
      void navigate(Routes.home(), { replace: true });
    } else {
      void navigate(returnTo, { replace: true, state });
    }
  }, [landing, libraryAccountId, navigate]);

  return { land, landing: landing !== null };
};
