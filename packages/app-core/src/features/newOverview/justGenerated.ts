// Router state, not a flag on the run: docs/features/plus-upsell.md, "16b — after a capture".
export const JUST_GENERATED = { justGenerated: true };

export const wasJustGenerated = (state: unknown): boolean => {
  return typeof state === "object" && state !== null && (state as { justGenerated?: unknown }).justGenerated === true;
};

// Null is a site already allowed, which needs no explaining.
export const oneTimeAccessHost = (state: unknown): string | null => {
  const host = (state as { oneTimeAccessHost?: unknown } | null)?.oneTimeAccessHost;
  return typeof host === "string" ? host : null;
};

export const ALREADY_MADE = { alreadyMade: true };

export const wasAlreadyMade = (state: unknown): boolean => (state as { alreadyMade?: unknown } | null)?.alreadyMade === true;
