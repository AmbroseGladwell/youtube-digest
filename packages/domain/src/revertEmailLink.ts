// Spent by a POST, since a scanner would spend a GET: docs/features/account-changes.md, "Moving it back".
export const REVERT_EMAIL_PATH = "/account/revert";

const TOKEN_PARAM = "token";

export const revertEmailLink = (appUrl: string, token: string): string => {
  return `${appUrl.replace(/\/+$/, "")}${REVERT_EMAIL_PATH}#${TOKEN_PARAM}=${encodeURIComponent(token)}`;
};

export const revertTokenFromHash = (hash: string): string | null => {
  const token = new URLSearchParams(hash.replace(/^#/, "")).get(TOKEN_PARAM);
  return token === null || token === "" ? null : token;
};
