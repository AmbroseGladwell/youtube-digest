import { overviewMetaParts, SHARE_PAYLOAD_ELEMENT_ID, type SharePayload } from "@overview/domain";
import { escapeHtml } from "./escapeHtml.js";

export interface SharePageHtmlInput {
  head: string;
  payload: SharePayload;
  shell: string | null;
}

// A JSON island is inert to a parser and to any script but the one that reads it, as long
// as nothing in it can close the element that carries it.
const payloadScript = (payload: SharePayload) =>
  `<script id="${SHARE_PAYLOAD_ELEMENT_ID}" type="application/json">${JSON.stringify(payload).replace(
    /</g,
    "\\u003c",
  )}</script>`;

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

// Served when this process has no built web app beside it — an API-only deploy, and every
// route test. The document is real and readable rather than a placeholder, but the reader's
// own layout is the app's job (docs/features/sharing.md).
function fallbackBody(payload: SharePayload): string {
  if (payload.state !== "shared") {
    const { heading, line } = GONE_COPY[payload.state];
    return `<main><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(line)}</p></main>`;
  }
  const { note } = payload.snapshot;
  return [
    "<main>",
    `<h1>${escapeHtml(note.video.title)}</h1>`,
    `<p>${escapeHtml(note.video.channel)} · ${escapeHtml(overviewMetaParts(note).join(" · "))}</p>`,
    `<p>${escapeHtml(note.inOneLine)}</p>`,
    `<p><a href="${escapeHtml(note.video.url)}">Watch on YouTube</a></p>`,
    "</main>",
  ].join("");
}

export function sharePageHtml({ head, payload, shell }: SharePageHtmlInput): string {
  const injected = `${head}\n    ${payloadScript(payload)}`;
  if (shell !== null && shell.includes("</head>")) {
    // The shell's own <title> goes, or a crawler reads that one and every shared link
    // previews as the app's name.
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
}
