import type { VideoSource } from "./VideoSource.js";
import { formatTimestamp } from "./formatTimestamp.js";
import type { TranscriptBlock } from "./TranscriptBlock.js";

// Shared by Copy and Export, so the two never disagree (docs/features/transcript-storage.md).
export const transcriptPlainText = (video: Pick<VideoSource, "title" | "channel" | "url">, blocks: TranscriptBlock[]): string => {
  const head = [video.title, video.channel, video.url].join("\n");
  const body = blocks.map((block) => `${formatTimestamp(block.startMs)}\t${block.speakerChange ? "— " : ""}${block.text}`).join("\n\n");
  return `${head}\n\n${body}\n`;
};
