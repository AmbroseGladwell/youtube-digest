// Carried on the navigation the side panel makes when a run finishes, so the reader can
// tell an overview that has just landed from one being read again later. Router state
// rather than a flag on the run: the run is over and dismissed by the time the reader
// is on screen (docs/features/plus-upsell.md).
export const JUST_GENERATED = { justGenerated: true };

export function wasJustGenerated(state: unknown): boolean {
  return (
    typeof state === "object" &&
    state !== null &&
    (state as { justGenerated?: unknown }).justGenerated === true
  );
}
