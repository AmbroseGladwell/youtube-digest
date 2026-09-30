import { isConsentPath } from "./consentPath.js";

// The link in the email points at the web app, which consumes the token with a POST: a
// GET that signed in would be spent by the first mail scanner to follow it. The token
// rides in the fragment so that the server serving the page never sees it in a request
// line or a log. A link asked for from the consent screen returns there once it has
// signed in (docs/features/sign-in.md).
export const SIGN_IN_PATH = "/sign-in";

const TOKEN_PARAM = "token";
const RETURN_PARAM = "return";

export function signInLink(appUrl: string, token: string, returnTo: string | null = null): string {
  const base = appUrl.replace(/\/+$/, "");
  const query = returnTo === null ? "" : `?${RETURN_PARAM}=${encodeURIComponent(returnTo)}`;
  return `${base}${SIGN_IN_PATH}${query}#${TOKEN_PARAM}=${encodeURIComponent(token)}`;
}

export function signInReturnFromSearch(search: string): string | null {
  const returnTo = new URLSearchParams(search).get(RETURN_PARAM);
  return returnTo !== null && isConsentPath(returnTo) ? returnTo : null;
}

export function signInTokenFromHash(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const token = params.get(TOKEN_PARAM);
  return token === null || token === "" ? null : token;
}
