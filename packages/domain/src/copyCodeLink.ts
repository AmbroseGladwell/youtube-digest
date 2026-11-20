// The Copy code link in a code-first mail (327l-3) opens a page of ours, since a mail client runs no
// script. The code rides in the fragment, as the sign-in token does, so it is never in a request
// line or a log while it can still sign someone in.
export const COPY_CODE_PATH = "/code";

export const copyCodeLink = (appUrl: string, code: string): string =>
  `${appUrl.replace(/\/+$/, "")}${COPY_CODE_PATH}#${encodeURIComponent(code)}`;

export function codeFromHash(hash: string): string | null {
  const code = decodeURIComponent(hash.replace(/^#/, "")).trim();
  return /^[A-Za-z0-9]{4}-?[A-Za-z0-9]{4}$/.test(code) ? code.toUpperCase() : null;
}
