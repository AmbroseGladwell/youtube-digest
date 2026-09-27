// The link in the email points at the web app, which consumes the token with a POST: a
// GET that signed in would be spent by the first mail scanner to follow it. The token
// rides in the fragment so that the server serving the page never sees it in a request
// line or a log (docs/features/sign-in.md).
export const SIGN_IN_PATH = "/sign-in";

const TOKEN_PARAM = "token";

export function signInLink(appUrl: string, token: string): string {
  const base = appUrl.replace(/\/+$/, "");
  return `${base}${SIGN_IN_PATH}#${TOKEN_PARAM}=${encodeURIComponent(token)}`;
}

export function signInTokenFromHash(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const token = params.get(TOKEN_PARAM);
  return token === null || token === "" ? null : token;
}
