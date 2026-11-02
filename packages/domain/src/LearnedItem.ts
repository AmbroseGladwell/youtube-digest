import { z } from "zod";

// One thing the profile pass has picked up about the reader. A removed item stays in the map
// with removedAt set: that is what keeps it from coming back, and being keyed lets two devices
// add and remove at once without one overwriting the other (docs/features/personalisation.md).
export const LearnedItem = z.object({
  text: z.string(),
  source: z.string(),
  learnedAt: z.iso.datetime(),
  noticedAt: z.iso.datetime().nullable(),
  removedAt: z.iso.datetime().nullable(),
});
export type LearnedItem = z.infer<typeof LearnedItem>;

export const LearnedItems = z.record(z.string(), LearnedItem);
export type LearnedItems = z.infer<typeof LearnedItems>;

export const learnedItemKey = (text: string): string => text.trim().toLowerCase().replace(/\s+/g, " ");

const newestFirst = (a: LearnedItem, b: LearnedItem) => b.learnedAt.localeCompare(a.learnedAt);

export const keptLearnedItems = (learned: LearnedItems): LearnedItem[] =>
  Object.values(learned)
    .filter(({ removedAt }) => removedAt === null)
    .sort(newestFirst);

export const removedLearnedItems = (learned: LearnedItems): LearnedItem[] =>
  Object.values(learned)
    .filter(({ removedAt }) => removedAt !== null)
    .sort(newestFirst);

export const unnoticedLearnedItems = (learned: LearnedItems): LearnedItem[] =>
  keptLearnedItems(learned).filter(({ noticedAt }) => noticedAt === null);

export const PROFILE_PASS_EVERY_OVERVIEWS = 3;
export const PROFILE_PASS_RECENT_OVERVIEWS = 12;
export const PROFILE_PASS_REMOVED_ITEMS = 50;
export const MAX_ITEMS_FROM_A_PASS = 2;
export const MAX_LEARNED_ITEM_LENGTH = 60;
// An item rests on at least this many overviews, so one video doesn't define a reader.
export const MIN_OVERVIEWS_BEHIND_AN_ITEM = 2;

export interface ProfilePassSchedule {
  overviewCount: number;
  countAtLastPass: number;
  keepLearning: boolean;
}

// Code decides when the pass runs and counts everything; the model never does
// (docs/prototype/constraints.md).
export const profilePassIsDue = ({ overviewCount, countAtLastPass, keepLearning }: ProfilePassSchedule): boolean =>
  keepLearning && overviewCount - countAtLastPass >= PROFILE_PASS_EVERY_OVERVIEWS;

export const ProfilePassOverview = z.object({
  title: z.string(),
  premise: z.string(),
  topics: z.array(z.string()),
  captureReason: z.string().nullable(),
});
export type ProfilePassOverview = z.infer<typeof ProfilePassOverview>;

export const ProfilePassInput = z.object({
  sentence: z.string().nullable(),
  learned: z.array(z.string()),
  removed: z.array(z.string()).max(PROFILE_PASS_REMOVED_ITEMS),
  overviews: z.array(ProfilePassOverview).min(1).max(PROFILE_PASS_RECENT_OVERVIEWS),
});
export type ProfilePassInput = z.infer<typeof ProfilePassInput>;

export const ProfilePassItem = z.object({ text: z.string(), source: z.string() });
export type ProfilePassItem = z.infer<typeof ProfilePassItem>;

export const ProfilePassResult = z.object({ items: z.array(ProfilePassItem) });
export type ProfilePassResult = z.infer<typeof ProfilePassResult>;
