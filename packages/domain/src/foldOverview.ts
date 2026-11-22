import { foldAskedQuestions } from "./AskedQuestion.js";
import { MAX_TAGS } from "./Filing.js";
import type { OverviewState } from "./OverviewState.js";

// Plain strings, since the fold runs on stored records too.
export interface FoldableFiling {
  topicIds: string[];
  tags: string[];
  captureReason: string | null;
}

export type FoldableState = Omit<OverviewState, "overviewId">;

const union = <T>(first: readonly T[], second: readonly T[]): T[] => [...first, ...second.filter((item) => !first.includes(item))];

// The first copy to reach the account wins; filing is a union (docs/features/one-overview-per-video.md).
export const foldFiling = (winner: FoldableFiling, loser: FoldableFiling): FoldableFiling => {
  return {
    topicIds: union(winner.topicIds, loser.topicIds),
    tags: union(winner.tags, loser.tags).slice(0, MAX_TAGS),
    captureReason: winner.captureReason ?? loser.captureReason,
  };
};

export const foldOverviewState = (winner: FoldableState, loser: FoldableState): FoldableState => {
  return {
    read: winner.read || loser.read,
    favourite: winner.favourite || loser.favourite,
    userTags: union(winner.userTags, loser.userTags),
    asked: foldAskedQuestions(winner.asked, loser.asked),
  };
};

// So a write onto the winner is never a no-op the server would refuse (docs/features/sync-api.md).
export const changedFields = <T extends object>(before: T, after: T): Partial<T> => {
  const changed: Partial<T> = {};
  for (const key of Object.keys(after) as Array<keyof T>) {
    if (!sameValue(before[key], after[key])) {
      changed[key] = after[key];
    }
  }
  return changed;
};

const sameValue = (left: unknown, right: unknown): boolean =>
  Array.isArray(left) && Array.isArray(right)
    ? left.length === right.length && left.every((item, index) => item === right[index])
    : left === right;
