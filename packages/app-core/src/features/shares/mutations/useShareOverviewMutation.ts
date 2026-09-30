import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_NARRATION_VOICE, spokenScript, type Overview, type Share } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import { useNarrationApi } from "../../player/NarrationApiContext.js";
import { useSettingsQuery } from "../../settings/queries/settingsQuery.js";
import { shareKeys } from "../shareKeys.js";
import { useShareApi } from "../ShareApiContext.js";
import { narrationForShare } from "../util/narrationForShare.js";
import { transcriptForShare } from "../util/transcriptForShare.js";

export interface ShareOverviewVariables {
  overview: Overview;
}

// Making a link and replacing the copy behind one are the same call, because to the reader
// they are the same act (docs/features/sharing.md). The transcript and the narration are
// gathered here rather than passed in, so every way of sharing sends the same copy.
export function useShareOverviewMutation() {
  const api = useShareApi();
  const narrationApi = useNarrationApi();
  const { transcriptStore } = useStores();
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
        transcript: await transcriptForShare(transcriptStore, overview),
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
}
