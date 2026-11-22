export interface ShownTopics {
  shown: readonly string[];
  more: number;
}

export const shownTopics = (topics: readonly string[], atMost: number): ShownTopics => {
  const shown = topics.slice(0, atMost);
  return { shown, more: topics.length - shown.length };
};
