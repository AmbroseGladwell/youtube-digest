import { buildSearchHaystack, type Overview } from "@overview/domain";

const haystacks = new WeakMap<Overview, string>();

export const searchHaystackOf = (overview: Overview): string => {
  let haystack = haystacks.get(overview);
  if (haystack === undefined) {
    haystack = buildSearchHaystack(overview);
    haystacks.set(overview, haystack);
  }
  return haystack;
};
