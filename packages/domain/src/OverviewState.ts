import { z } from "zod";
import { tagPattern } from "./Filing.js";
import { OverviewId } from "./Brands.js";
import { AskedQuestions } from "./AskedQuestion.js";

export const OverviewState = z.object({
  overviewId: OverviewId,
  read: z.boolean(),
  favourite: z.boolean(),
  userTags: z.array(z.string().regex(tagPattern)),
  // Absent from state saved before OV-266 asked anything.
  asked: AskedQuestions.default([]),
});
export type OverviewState = z.infer<typeof OverviewState>;

export const DEFAULT_OVERVIEW_STATE: Omit<OverviewState, "overviewId"> = {
  read: false,
  favourite: false,
  userTags: [],
  asked: [],
};
