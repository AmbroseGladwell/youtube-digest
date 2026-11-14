import type { Overview } from "./Overview.js";
import { overviewMarkdown } from "./overviewMarkdown.js";

// Round C of the owner's test on 14 November 2026: without it ChatGPT answered from the web,
// and cited transcript sites, rather than reading the reader's own copy.
export const CONNECTED_FOLLOW_UP_INSTRUCTION =
  "Use The Overview to answer. Read this overview with get_overview, and if you need more than it says, " +
  "read its transcript with get_transcript rather than searching the web. Cite the overview's timestamps.";

// What a question takes to the reader's assistant. Connected to The Overview, it names the
// overview for the assistant to read; otherwise it carries the whole note.
export function followUpPrompt(question: string, overview: Overview, connected: boolean): string {
  const asked = `<question>${question}</question>`;
  return connected
    ? `${CONNECTED_FOLLOW_UP_INSTRUCTION}\n${asked}\n<overview>${overview.source.title} (The Overview id ${overview.id})</overview>`
    : `${asked}\n\n<overview>\n${overviewMarkdown(overview)}</overview>`;
}
