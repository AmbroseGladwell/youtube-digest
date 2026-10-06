// What the reader types or the model writes, as a stored tag: lowercase, hyphenated, and
// null when nothing is left to call it (docs/features/tag-reuse.md).
export function normaliseTag(raw: string): string | null {
  const tag = raw
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return tag === "" ? null : tag;
}
