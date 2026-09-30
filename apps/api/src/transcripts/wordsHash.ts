import { createHash } from "node:crypto";
import type { StoredTranscript } from "@overview/domain";

// What two accounts have to agree on for a copy to be served: the words and whether a
// person wrote them, never how they were cut into segments or when they were fetched
// (docs/features/shared-transcript-cache.md, "Two accounts have to agree").
export function wordsHash(transcript: StoredTranscript): string {
  const words = transcript.segments
    .map((segment) => segment.text)
    .join(" ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return createHash("sha256")
    .update(`${transcript.generated ? "generated" : "written"}\n${words}`)
    .digest("hex");
}
