import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Settings } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import { settingsKeys } from "../settingsKeys.js";

interface UpdateSettingsContext {
  previous: Settings | undefined;
}

export function useUpdateSettingsMutation() {
  const { settingsStore } = useStores();
  const queryClient = useQueryClient();

  return useMutation<Settings, Error, Partial<Settings>, UpdateSettingsContext>({
    mutationKey: settingsKeys.all,
    mutationFn: (patch) => settingsStore.update(patch),

    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: settingsKeys.all });
      const previous = queryClient.getQueryData<Settings>(settingsKeys.all);
      if (previous) {
        queryClient.setQueryData<Settings>(settingsKeys.all, { ...previous, ...patch });
      }
      return { previous };
    },

    onError: (_error, _patch, context) => {
      if (context?.previous) {
        queryClient.setQueryData(settingsKeys.all, context.previous);
      }
    },

    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: settingsKeys.all }) === 1) {
        void queryClient.invalidateQueries({ queryKey: settingsKeys.all });
      }
    },
  });
}
