// Lowercase, hyphenated, or null when nothing is left (docs/features/tag-reuse.md).
export const normaliseTag = (raw: string): string | null => {
  const tag = raw
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return tag === "" ? null : tag;
};
