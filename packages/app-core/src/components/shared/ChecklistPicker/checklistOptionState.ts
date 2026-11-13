import type { ChecklistState } from "./ChecklistPicker.js";

export const checklistOptionState = (held: number, of: number): ChecklistState => (held === 0 ? "none" : held >= of ? "all" : "some");

export const sharedChecklistHint = "Changes save as you go. A dash means some of them have it; tick to give it to all of them.";

const FOOT_NAMES = 3;

// "Home on all 3 · Money on 1" (168as).
export const sharedChecklistFoot = (options: { name: string; held: number }[], of: number, none: string): string => {
  const held = options.filter((option) => option.held > 0);
  if (held.length === 0) return none;
  const named = held.slice(0, FOOT_NAMES).map(({ name, held: count }) => (count >= of ? `${name} on all ${of}` : `${name} on ${count}`));
  return held.length > FOOT_NAMES ? `${named.join(" · ")} · and ${held.length - FOOT_NAMES} more` : named.join(" · ");
};
