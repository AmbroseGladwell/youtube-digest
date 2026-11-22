import { createHash } from "node:crypto";
import type { StoredTranscript } from "@overview/domain";

// Why only these are hashed: docs/features/shared-transcript-cache.md, "Two accounts have to agree".
export const wordsHash = (transcript: StoredTranscript): string => {
  const words = transcript.segments
    .map((segment) => segment.text)
    .join(" ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return createHash("sha256")
    .update(`${transcript.generated ? "generated" : "written"}\n${words}`)
    .digest("hex");
};
