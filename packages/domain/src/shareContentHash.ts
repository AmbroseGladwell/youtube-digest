import type { SharedNote } from "./SharedNote.js";

const compareKeys = (left: string, right: string): number => {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
};

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => compareKeys(left, right));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(",")}}`;
};

// Split from the hashing, as narrationKeySource is, so a node:crypto caller can do it synchronously.
export const shareContentSource = (note: SharedNote): string => stableStringify(note);

// The note alone: a later transcript or voice isn't the reader's edit (docs/features/sharing.md).
export const shareContentHash = async (note: SharedNote): Promise<string> => {
  const bytes = new TextEncoder().encode(shareContentSource(note));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};
