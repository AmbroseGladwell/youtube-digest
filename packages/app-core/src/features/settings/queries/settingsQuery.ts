import { queryOptions, useQuery } from "@tanstack/react-query";
import type { SettingsStore } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import { settingsKeys } from "../settingsKeys.js";

export const settingsQueryOptions = (settingsStore: SettingsStore) =>
  queryOptions({
    queryKey: settingsKeys.all,
    queryFn: () => settingsStore.get(),
  });

export const useSettingsQuery = () => {
  const { settingsStore } = useStores();
  return useQuery(settingsQueryOptions(settingsStore));
};
