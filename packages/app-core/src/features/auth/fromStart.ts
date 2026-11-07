// Sign in's state when Start sent the reader there, so the bar offers the way back to what
// home is about (205g-4). The gate sends nobody back to itself, so it sets none.
export const fromStart = { fromStart: true } as const;

export const isFromStart = (state: unknown): boolean =>
  typeof state === "object" && state !== null && (state as { fromStart?: unknown }).fromStart === true;
