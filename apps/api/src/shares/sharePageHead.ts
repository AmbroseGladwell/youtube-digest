import { sharePath, sharePreview, type SharedNote } from "@overview/domain";
import { escapeHtml } from "./escapeHtml.js";

export interface SharePageHeadInput {
  note: SharedNote;
  token: string;
  appUrl: string;
  hasNarration: boolean;
}

const meta = (attribute: "property" | "name", key: string, content: string) =>
  `<meta ${attribute}="${key}" content="${escapeHtml(content)}">`;

// The head a link preview reads, and the only reason this page is a document the server
// writes rather than a route the app owns. noindex because a shared copy is for the people
// the reader sent it to, and nothing here names the sharer (docs/features/sharing.md).
export function sharePageHead({ note, token, appUrl, hasNarration }: SharePageHeadInput): string {
  const { title, description } = sharePreview(note);
  const url = new URL(sharePath(token), appUrl).toString();

  return [
    `<title>${escapeHtml(title)} · The Overview</title>`,
    meta("name", "robots", "noindex, nofollow"),
    meta("name", "description", description),
    meta("property", "og:type", "article"),
    meta("property", "og:site_name", "The Overview"),
    meta("property", "og:title", title),
    meta("property", "og:description", description),
    meta("property", "og:url", url),
    meta("property", "og:image", `${url}/card.png`),
    meta("property", "og:image:width", "1200"),
    meta("property", "og:image:height", "630"),
    ...(hasNarration ? [meta("property", "og:audio", `${url}/audio.mp3`)] : []),
    meta("name", "twitter:card", "summary_large_image"),
  ].join("\n    ");
}

// A link the reader turned off, and one that was never issued, both answer with a page
// rather than a bare status. Neither says anything about the overview that was there.
export function goneHead(what: string): string {
  return [`<title>${escapeHtml(what)} · The Overview</title>`, meta("name", "robots", "noindex, nofollow")].join(
    "\n    ",
  );
}
