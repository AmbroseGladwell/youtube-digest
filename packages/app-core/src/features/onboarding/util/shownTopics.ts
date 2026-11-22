export interface ShownTopics {
  shown: readonly string[];
  more: number;
}

// The first few of the reader's topics, and how many more there are to say "and N more" for.
export const shownTopics = (topics: readonly string[], atMost: number): ShownTopics => {
  const shown = topics.slice(0, atMost);
  return { shown, more: topics.length - shown.length };
};
