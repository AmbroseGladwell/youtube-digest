import type { Overview } from "./Overview.js";
import { overviewMarkdown } from "./overviewMarkdown.js";

// Owner test, 14 Nov 2026: without it ChatGPT answered from the web, not the reader's copy.
export const CONNECTED_FOLLOW_UP_INSTRUCTION =
  "Use The Overview to answer. Read this overview with get_overview, and if you need more than it says, " +
  "read its transcript with get_transcript rather than searching the web. Cite the overview's timestamps.";

// Unconnected, the note less its questions, so only the one asked is answered (owner, 15 Nov 2026).
export const followUpPrompt = (question: string, overview: Overview, connected: boolean): string => {
  const asked = `<question>${question}</question>`;
  return connected
    ? `${CONNECTED_FOLLOW_UP_INSTRUCTION}\n${asked}\n<overview>${overview.source.title} (The Overview id ${overview.id})</overview>`
    : `${asked}\n\n<overview>\n${overviewMarkdown({ ...overview, followUpQuestions: null })}</overview>`;
};
