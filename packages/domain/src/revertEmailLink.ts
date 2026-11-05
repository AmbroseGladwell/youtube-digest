// The button in the old address's mail opens the web app, which spends the token with a
// POST, for the same reason a sign-in link does: a GET that acted would be spent by the
// first mail scanner to follow it. The token rides in the fragment
// (docs/features/account-changes.md, "Moving it back").
export const REVERT_EMAIL_PATH = "/account/revert";

const TOKEN_PARAM = "token";

export function revertEmailLink(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/+$/, "")}${REVERT_EMAIL_PATH}#${TOKEN_PARAM}=${encodeURIComponent(token)}`;
}

export function revertTokenFromHash(hash: string): string | null {
  const token = new URLSearchParams(hash.replace(/^#/, "")).get(TOKEN_PARAM);
  return token === null || token === "" ? null : token;
}
