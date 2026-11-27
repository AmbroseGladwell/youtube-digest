// Order kept, a new topic first: docs/features/suggested-questions.md, "Spread across topics".
export const spreadAcrossTopics = <T>(
  items: readonly T[],
  topicsOf: (item: T) => readonly string[],
  limit: number,
  covered: Iterable<string> = [],
): T[] => {
  const seen = new Set(covered);
  const taken: T[] = [];
  for (const item of items) {
    if (taken.length >= limit) {
      break;
    }
    const topics = topicsOf(item);
    if (!topics.some((topic) => seen.has(topic))) {
      taken.push(item);
      topics.forEach((topic) => seen.add(topic));
    }
  }
  for (const item of items) {
    if (taken.length >= limit) {
      break;
    }
    if (!taken.includes(item)) {
      taken.push(item);
    }
  }
  return taken;
};
