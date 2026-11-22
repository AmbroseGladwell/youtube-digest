import { sourceKey, type QueuedCapture } from "@overview/domain";
import type { LibraryEntry } from "../../overviews/types/LibraryEntry.js";

export const madeAlready = (captures: readonly QueuedCapture[], library: readonly LibraryEntry[]): Set<string> => {
  const held = new Set<string>(
    library.flatMap((entry) => {
      const source = entry.kind === "overview" ? entry.overview.source : entry.record.salvaged?.source;
      return source == null ? [] : (sourceKey(source) ?? []);
    }),
  );
  return new Set(captures.filter((capture) => held.has(capture.videoId)).map((capture) => capture.videoId));
};
