// Home's state when Create account sent the reader there, so a panel whose home leads with
// signing back in shows Start instead (docs/features/onboarding.md, "Every Create account").
export const startAsked = { start: true } as const;

export const isStartAsked = (state: unknown): boolean =>
  typeof state === "object" && state !== null && (state as { start?: unknown }).start === true;
