import type { NoteKind } from "@overview/domain";
import { checkNoteKind, type KindSample } from "@overview/generation";
import type { OverviewKeys } from "./makeOverviewOnKeys.js";

// The key the overview would be written with first, so an own key's words never go through us.
export const checkKindOnKeys = async (
  { order, own, api }: Pick<OverviewKeys, "order" | "own" | "api">,
  sample: KindSample,
): Promise<NoteKind> => {
  if (order[0] === "own" && own !== null) {
    return checkNoteKind(own.client, sample);
  }
  if (order[0] === "ours" && api !== null) {
    return (await api.kindCheck(sample)).noteKind;
  }
  throw new Error("There is no key to check this video's kind with.");
};
