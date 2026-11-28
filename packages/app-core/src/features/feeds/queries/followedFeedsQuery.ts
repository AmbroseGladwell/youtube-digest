import { queryOptions, useQuery } from "@tanstack/react-query";
import type { FollowedFeed, FollowedFeedStore } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import { feedKeys } from "../feedKeys.js";

// The order they were followed in.
export const followedFeedsQueryOptions = (store: FollowedFeedStore) =>
  queryOptions({
    queryKey: feedKeys.followed(),
    queryFn: async (): Promise<FollowedFeed[]> =>
      (await store.listFollowed()).sort((left, right) => left.followedAt.localeCompare(right.followedAt)),
  });

export const useFollowedFeedsQuery = () => {
  const { followedFeedStore } = useStores();
  return useQuery(followedFeedsQueryOptions(followedFeedStore));
};
