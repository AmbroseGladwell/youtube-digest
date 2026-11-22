import type { TranscriptBlock } from "@overview/domain";

// Why this size: docs/features/mcp-connector.md, "The context budget".
export const TRANSCRIPT_PAGE_CHARS = 30_000;

export const TIMESTAMP = /^\d+(?::\d{1,2}){0,2}$/;

export const millisecondsOf = (timestamp: string): number | null => {
  const trimmed = timestamp.trim();
  if (!TIMESTAMP.test(trimmed)) {
    return null;
  }
  const seconds = trimmed.split(":").reduce((total, part) => total * 60 + Number(part), 0);
  return seconds * 1000;
};

export const blockIndexAt = (blocks: readonly TranscriptBlock[], ms: number): number => {
  const after = blocks.findIndex((block) => block.endMs > ms);
  return after === -1 ? blocks.length : after;
};

export interface TranscriptPage {
  blocks: TranscriptBlock[];
  next: number | null;
}

export const transcriptPage = (blocks: readonly TranscriptBlock[], first: number, maxChars = TRANSCRIPT_PAGE_CHARS): TranscriptPage => {
  let end = first;
  let chars = 0;
  while (end < blocks.length && (end === first || chars + blocks[end]!.text.length <= maxChars)) {
    chars += blocks[end]!.text.length;
    end += 1;
  }
  return { blocks: blocks.slice(first, end), next: end < blocks.length ? end : null };
};
