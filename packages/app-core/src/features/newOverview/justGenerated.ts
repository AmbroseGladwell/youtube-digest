// Carried on the navigation the side panel makes when a run finishes, so the reader can
// tell an overview that has just landed from one being read again later. Router state
// rather than a flag on the run: the run is over and dismissed by the time the reader
// is on screen (docs/features/plus-upsell.md).
export const JUST_GENERATED = { justGenerated: true };

export function wasJustGenerated(state: unknown): boolean {
  return typeof state === "object" && state !== null && (state as { justGenerated?: unknown }).justGenerated === true;
}

// The right-click route got in on one-time access, so the Create button there may still ask
// (design 77ah). Null is a site already allowed, which needs no explaining.
export const oneTimeAccessHost = (state: unknown): string | null => {
  const host = (state as { oneTimeAccessHost?: unknown } | null)?.oneTimeAccessHost;
  return typeof host === "string" ? host : null;
};

// The panel opened what it already had rather than making another (design 77as).
export const ALREADY_MADE = { alreadyMade: true };

export const wasAlreadyMade = (state: unknown): boolean => (state as { alreadyMade?: unknown } | null)?.alreadyMade === true;
