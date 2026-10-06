export interface TagCount {
  tag: string;
  count: number;
}

// Each tag, with how many notes carry it: most used first, then A–Z.
export function tagUsage(tagLists: Iterable<readonly string[]>): TagCount[] {
  const counts = new Map<string, number>();
  for (const tags of tagLists) {
    for (const tag of new Set(tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag));
}
