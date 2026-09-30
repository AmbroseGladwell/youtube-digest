import { overviewMetaParts } from "./overviewMetaParts.js";
import type { SharedNote } from "./SharedNote.js";

export interface SharePreview {
  title: string;
  description: string;
}

// What Messages, Slack and WhatsApp show. The lengths first, then the premise, and no
// verdict: a blunt judgement of someone else's video is the reader's to deliver in their
// own message, not something the preview says for them. The premise goes in whole rather
// than cut at its first full stop — it is at most 25 words, and a sentence splitter would
// be guessing (docs/features/sharing.md).
export function sharePreview(note: SharedNote): SharePreview {
  return {
    title: note.video.title,
    description: `${overviewMetaParts(note).join(" · ")}. ${note.inOneLine}`,
  };
}
