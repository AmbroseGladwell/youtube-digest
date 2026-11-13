export const projectKeys = {
  all: ["project"] as const,
  list: () => [...projectKeys.all, "list"] as const,
  members: () => [...projectKeys.all, "members"] as const,
};
