import type { TagCount } from "@overview/domain";

export const TAG_LIMIT = 6;

export interface CappedTags {
  shown: TagCount[];
  hiddenCount: number;
}

export const cappedTags = (tags: TagCount[], selected: string | null, limit: number = TAG_LIMIT): CappedTags => {
  const shown = tags.slice(0, limit);
  const chosen = tags.find(({ tag }) => tag === selected);
  if (chosen && !shown.includes(chosen)) {
    shown.push(chosen);
  }
  return { shown, hiddenCount: tags.length - shown.length };
};
