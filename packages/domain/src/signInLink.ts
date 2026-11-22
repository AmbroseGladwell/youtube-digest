import { isConsentPath } from "./consentPath.js";

// Spent by a POST, the token in the fragment, away from logs (docs/features/sign-in.md).
export const SIGN_IN_PATH = "/sign-in";

const TOKEN_PARAM = "token";
const RETURN_PARAM = "return";

export const signInLink = (appUrl: string, token: string, returnTo: string | null = null): string => {
  const base = appUrl.replace(/\/+$/, "");
  const query = returnTo === null ? "" : `?${RETURN_PARAM}=${encodeURIComponent(returnTo)}`;
  return `${base}${SIGN_IN_PATH}${query}#${TOKEN_PARAM}=${encodeURIComponent(token)}`;
};

export const signInReturnFromSearch = (search: string): string | null => {
  const returnTo = new URLSearchParams(search).get(RETURN_PARAM);
  return returnTo !== null && isConsentPath(returnTo) ? returnTo : null;
};

export const signInTokenFromHash = (hash: string): string | null => {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const token = params.get(TOKEN_PARAM);
  return token === null || token === "" ? null : token;
};
