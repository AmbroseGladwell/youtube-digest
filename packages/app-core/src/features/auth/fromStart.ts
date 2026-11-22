// So the bar offers the way back to Start; the gate sends nobody back to itself, so it sets none.
export const fromStart = { fromStart: true } as const;

export const isFromStart = (state: unknown): boolean =>
  typeof state === "object" && state !== null && (state as { fromStart?: unknown }).fromStart === true;
