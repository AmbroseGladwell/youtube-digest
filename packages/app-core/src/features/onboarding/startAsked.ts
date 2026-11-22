// docs/features/onboarding.md, "Every Create account".
export const startAsked = { start: true } as const;

export const isStartAsked = (state: unknown): boolean =>
  typeof state === "object" && state !== null && (state as { start?: unknown }).start === true;
