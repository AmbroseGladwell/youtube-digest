export const captureQueueKeys = {
  all: ["captureQueue"] as const,
  list: () => [...captureQueueKeys.all, "list"] as const,
};
