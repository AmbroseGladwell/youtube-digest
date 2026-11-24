import {
  clipPlatformName,
  isClipSource,
  openPodcastLabel,
  overviewMetaParts,
  SHARE_PAYLOAD_ELEMENT_ID,
  type SharePayload,
  type SharedNote,
  sourceName,
  sourceUrl,
  isWrittenPost,
} from "@overview/domain";
import { escapeHtml } from "./escapeHtml.js";

export interface SharePageHtmlInput {
  head: string;
  payload: SharePayload;
  shell: string | null;
}

// Escaping < keeps anything in the payload from closing the element that carries it.
const payloadScript = (payload: SharePayload) =>
  `<script id="${SHARE_PAYLOAD_ELEMENT_ID}" type="application/json">${JSON.stringify(payload).replace(/</g, "\\u003c")}</script>`;

const GONE_COPY: Record<"revoked" | "unknown", { heading: string; line: string }> = {
  revoked: {
    heading: "This overview is no longer shared",
    line: "The person who shared it has turned the link off.",
  },
  unknown: {
    heading: "This link doesn’t go anywhere",
    line: "Check the link you were sent, or ask for it again.",
  },
};

// For a process with no built web app beside it: an API-only deploy, and every route test.
const fallbackBody = (payload: SharePayload): string => {
  if (payload.state !== "shared") {
    const { heading, line } = GONE_COPY[payload.state];
    return `<main><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(line)}</p></main>`;
  }
  const { note } = payload.snapshot;
  return [
    "<main>",
    `<h1>${escapeHtml(note.source.title)}</h1>`,
    `<p>${escapeHtml(sourceName(note.source))} · ${escapeHtml(overviewMetaParts(note).join(" · "))}</p>`,
    `<p>${escapeHtml(note.inOneLine)}</p>`,
    `<p><a href="${escapeHtml(sourceUrl(note.source))}">${escapeHtml(wayOut(note))}</a></p>`,
    "</main>",
  ].join("");
};

const wayOut = ({ source, recipe }: SharedNote): string => {
  if (source.kind === "youtube") {
    return "Watch on YouTube";
  }
  if (source.kind === "podcast") {
    return openPodcastLabel(source.sharedFrom);
  }
  if (isClipSource(source)) {
    return `${isWrittenPost(source) ? "Open" : "Watch"} on ${clipPlatformName(source)}`;
  }
  return `${recipe == null ? "Read the article" : "Open the recipe"} on ${sourceName(source)}`;
};

export const sharePageHtml = ({ head, payload, shell }: SharePageHtmlInput): string => {
  const injected = `${head}\n    ${payloadScript(payload)}`;
  if (shell !== null && shell.includes("</head>")) {
    // Drops the shell's <title>, or every shared link previews as the app's name.
    return shell.replace(/\s*<title>[\s\S]*?<\/title>/i, "").replace("</head>", `    ${injected}\n  </head>`);
  }
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    ${injected}
  </head>
  <body>${fallbackBody(payload)}</body>
</html>
`;
};
