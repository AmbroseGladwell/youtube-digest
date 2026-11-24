import { sourceKey, type QueuedCapture, type SourceReference } from "@overview/domain";
import type { LibraryEntry } from "../../overviews/types/LibraryEntry.js";

const madeSourceOf = (entry: LibraryEntry): SourceReference | null | undefined => {
  switch (entry.kind) {
    case "overview":
      return entry.overview.source;
    case "unreadable":
      return entry.record.salvaged?.source;
    case "capture":
      return null;
  }
};

export const madeAlready = (captures: readonly QueuedCapture[], library: readonly LibraryEntry[]): Set<string> => {
  const held = new Set<string>(
    library.flatMap((entry) => {
      const source = madeSourceOf(entry);
      return source == null ? [] : (sourceKey(source) ?? []);
    }),
  );
  return new Set(captures.filter((capture) => held.has(capture.videoId)).map((capture) => capture.videoId));
};
