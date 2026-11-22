import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_NARRATION_VOICE, spokenScript, type Overview, type Share } from "@overview/domain";
import { useNarrationApi } from "../../player/NarrationApiContext.js";
import { useSettingsQuery } from "../../settings/queries/settingsQuery.js";
import { shareKeys } from "../shareKeys.js";
import { useShareApi } from "../ShareApiContext.js";
import { narrationForShare } from "../util/narrationForShare.js";

export interface ShareOverviewVariables {
  overview: Overview;
}

// No transcript: docs/features/sharing.md, "What is in a shared copy, and what is not".
export const useShareOverviewMutation = () => {
  const api = useShareApi();
  const narrationApi = useNarrationApi();
  const voice = useSettingsQuery().data?.narrationVoice ?? DEFAULT_NARRATION_VOICE;
  const queryClient = useQueryClient();

  return useMutation<Share, Error, ShareOverviewVariables>({
    mutationKey: shareKeys.all,
    mutationFn: async ({ overview }) => {
      if (api === null) {
        throw new Error("This shell has no account to share under");
      }
      return api.share({
        overview,
        narration: await narrationForShare(narrationApi, spokenScript(overview), voice),
      });
    },

    onSuccess: (share) => {
      queryClient.setQueryData<Share[]>(shareKeys.list, (shares) => [
        share,
        ...(shares ?? []).filter((existing) => existing.token !== share.token),
      ]);
    },

    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: shareKeys.all }) === 1) {
        void queryClient.invalidateQueries({ queryKey: shareKeys.all });
      }
    },
  });
};
