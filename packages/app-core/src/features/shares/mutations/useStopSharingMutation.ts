import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Share } from "@overview/domain";
import { shareKeys } from "../shareKeys.js";
import { useShareApi } from "../ShareApiContext.js";

export interface StopSharingVariables {
  token: string;
}

interface StopSharingContext {
  previous: Share[] | undefined;
}

// Optimistic, because the reader has already decided: the row goes at once, and comes back
// only if the server refuses.
export function useStopSharingMutation() {
  const api = useShareApi();
  const queryClient = useQueryClient();

  return useMutation<void, Error, StopSharingVariables, StopSharingContext>({
    mutationKey: shareKeys.all,
    mutationFn: async ({ token }) => {
      if (api === null) {
        throw new Error("This shell has no account to stop sharing under");
      }
      await api.stop(token);
    },

    onMutate: async ({ token }) => {
      await queryClient.cancelQueries({ queryKey: shareKeys.all });
      const previous = queryClient.getQueryData<Share[]>(shareKeys.list);
      queryClient.setQueryData<Share[]>(shareKeys.list, (shares) =>
        (shares ?? []).filter((share) => share.token !== token),
      );
      return { previous };
    },

    onError: (_error, _variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(shareKeys.list, context.previous);
      }
    },

    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: shareKeys.all }) === 1) {
        void queryClient.invalidateQueries({ queryKey: shareKeys.all });
      }
    },
  });
}
