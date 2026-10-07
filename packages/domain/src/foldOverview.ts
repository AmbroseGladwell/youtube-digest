import { MAX_TAGS } from "./Filing.js";
import type { OverviewState } from "./OverviewState.js";

// Plain strings rather than the branded ids, because the fold runs on stored records as
// well as parsed ones.
export interface FoldableFiling {
  topicIds: string[];
  tags: string[];
  captureReason: string | null;
}

export type FoldableState = Omit<OverviewState, "overviewId">;

const union = <T>(first: readonly T[], second: readonly T[]): T[] => [
  ...first,
  ...second.filter((item) => !first.includes(item)),
];

// Two overviews of one video become one: the copy that reached the account first is kept
// and the other's filing is folded onto it. Topics and tags are a union, the winner's
// first and capped where the record caps them; the capture reason is the winner's unless
// it has none (docs/features/one-overview-per-video.md).
export function foldFiling(winner: FoldableFiling, loser: FoldableFiling): FoldableFiling {
  return {
    topicIds: union(winner.topicIds, loser.topicIds),
    tags: union(winner.tags, loser.tags).slice(0, MAX_TAGS),
    captureReason: winner.captureReason ?? loser.captureReason,
  };
}

// Read and favourite are kept if either copy had them; user tags are a union.
export function foldOverviewState(winner: FoldableState, loser: FoldableState): FoldableState {
  return {
    read: winner.read || loser.read,
    favourite: winner.favourite || loser.favourite,
    userTags: union(winner.userTags, loser.userTags),
  };
}

// Only the fields the fold changed, so a write onto the winner is never a no-op the server
// would refuse (docs/features/sync-api.md).
export function changedFields<T extends object>(before: T, after: T): Partial<T> {
  const changed: Partial<T> = {};
  for (const key of Object.keys(after) as Array<keyof T>) {
    if (!sameValue(before[key], after[key])) changed[key] = after[key];
  }
  return changed;
}

const sameValue = (left: unknown, right: unknown): boolean =>
  Array.isArray(left) && Array.isArray(right)
    ? left.length === right.length && left.every((item, index) => item === right[index])
    : left === right;
