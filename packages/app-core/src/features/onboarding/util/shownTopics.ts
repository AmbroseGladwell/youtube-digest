// The first few of the reader's topics, and how many more there are to say "and N more" for.
export function shownTopics(topics: readonly string[], atMost: number): { shown: readonly string[]; more: number } {
  const shown = topics.slice(0, atMost);
  return { shown, more: topics.length - shown.length };
}
