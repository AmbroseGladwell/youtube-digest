import type { VideoSource } from "@overview/domain";
import { formatTimestamp } from "../../../util/formatTimestamp.js";
import type { TranscriptBlock } from "../types/TranscriptBlock.js";

// What Copy puts on the clipboard and what Export writes to the file — one function, so
// the two can't disagree about what a transcript looks like outside the app. The blocks
// are the merged, reading-grain ones the tab shows rather than the stored cues, and each
// carries the time its first words were said (docs/features/transcript-storage.md).
export function transcriptPlainText(video: VideoSource, blocks: TranscriptBlock[]): string {
  const head = [video.title, video.channel, video.url].join("\n");
  const body = blocks
    .map(
      (block) =>
        `${formatTimestamp(block.startMs)}\t${block.speakerChange ? "— " : ""}${block.text}`,
    )
    .join("\n\n");
  return `${head}\n\n${body}\n`;
}
