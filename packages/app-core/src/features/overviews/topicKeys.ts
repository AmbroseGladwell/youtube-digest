export const topicKeys = {
  all: ["topic"] as const,
  lists: ["topic", "list"] as const,
  list: () => [...topicKeys.lists] as const,
};
