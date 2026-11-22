import type { TagAliases } from "./TagAliases.js";

// One step deep, so resolving a tag is one lookup.
export const withTagAlias = (aliases: TagAliases, from: string, to: string | null): TagAliases => {
  const next: TagAliases = {};
  for (const [alias, target] of Object.entries(aliases)) {
    next[alias] = target === from ? to : target;
  }
  next[from] = to;
  if (to !== null) {
    delete next[to];
  }
  for (const [alias, target] of Object.entries(next)) {
    if (alias === target) {
      delete next[alias];
    }
  }
  return next;
};
