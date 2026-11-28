export const feedKeys = {
  all: ["feed"] as const,
  followed: () => [...feedKeys.all, "followed"] as const,
};
