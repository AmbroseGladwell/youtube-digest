import type { FollowUpHandOff } from "@overview/domain";

// Opens the assistant in a new tab, copying the prompt first when the link can't carry it. Both
// happen inside the tap, which is what lets a browser allow either (docs/features/follow-up-questions.md).
export const handOffFollowUp = (handOff: FollowUpHandOff): Promise<boolean> => {
  const copied = handOff.kind === "copyThenOpen" ? copyText(handOff.text) : Promise.resolve(true);
  window.open(handOff.url, "_blank", "noopener,noreferrer");
  return copied;
};

export const copyText = (text: string): Promise<boolean> => {
  if (typeof navigator === "undefined" || navigator.clipboard?.writeText === undefined) {
    return Promise.resolve(false);
  }
  return navigator.clipboard.writeText(text).then(
    () => true,
    () => false,
  );
};
