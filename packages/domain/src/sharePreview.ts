import { overviewMetaParts } from "./overviewMetaParts.js";
import type { SharedNote } from "./SharedNote.js";

export interface SharePreview {
  title: string;
  description: string;
}

// No verdict, and the premise whole, never sentence-split (docs/features/sharing.md).
export const sharePreview = (note: SharedNote): SharePreview => {
  return {
    title: note.source.title,
    description: `${overviewMetaParts(note).join(" · ")}. ${note.inOneLine}`,
  };
};
