import { sharePath, sharePreview, type SharedNote } from "@overview/domain";
import { escapeHtml } from "./escapeHtml.js";
import { OG_TITLE } from "../podcasts/pageMeta.js";

export interface SharePageHeadInput {
  note: SharedNote;
  token: string;
  appUrl: string;
  hasNarration: boolean;
}

const meta = (attribute: "property" | "name", key: string, content: string) =>
  `<meta ${attribute}="${key}" content="${escapeHtml(content)}">`;

// What a link preview reads, and why noindex: docs/features/sharing.md, "The head".
export const sharePageHead = ({ note, token, appUrl, hasNarration }: SharePageHeadInput): string => {
  const { title, description } = sharePreview(note);
  const url = new URL(sharePath(token), appUrl).toString();

  return [
    `<title>${escapeHtml(title)} · The Overview</title>`,
    meta("name", "robots", "noindex, nofollow"),
    meta("name", "description", description),
    meta("property", "og:type", "article"),
    meta("property", "og:site_name", "The Overview"),
    meta("property", OG_TITLE, title),
    meta("property", "og:description", description),
    meta("property", "og:url", url),
    meta("property", "og:image", `${url}/card.png`),
    meta("property", "og:image:width", "1200"),
    meta("property", "og:image:height", "630"),
    ...(hasNarration ? [meta("property", "og:audio", `${url}/audio.mp3`)] : []),
    meta("name", "twitter:card", "summary_large_image"),
  ].join("\n    ");
};

// Says nothing about the overview that was there: docs/features/sharing.md, "410, not 404".
export const goneHead = (what: string): string => {
  return [`<title>${escapeHtml(what)} · The Overview</title>`, meta("name", "robots", "noindex, nofollow")].join("\n    ");
};
