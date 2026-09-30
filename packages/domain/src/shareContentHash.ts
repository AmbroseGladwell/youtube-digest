import type { SharedNote } from "./SharedNote.js";

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(",")}}`;
};

// What "you've edited this overview since sharing it" compares. It covers the note alone:
// a transcript filled in later, or narration rendered in another voice, is not an edit the
// reader made, and telling them it was would train them to ignore the notice
// (docs/features/sharing.md).
export async function shareContentHash(note: SharedNote): Promise<string> {
  const bytes = new TextEncoder().encode(stableStringify(note));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
