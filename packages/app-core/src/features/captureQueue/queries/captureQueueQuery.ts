import { queryOptions, useQuery } from "@tanstack/react-query";
import type { CaptureQueueStore } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import { captureQueueKeys } from "../captureQueueKeys.js";

export const captureQueueQueryOptions = (store: CaptureQueueStore) =>
  queryOptions({
    queryKey: captureQueueKeys.list(),
    queryFn: () => store.listQueue(),
  });

export const useCaptureQueueQuery = () => {
  const { captureQueueStore } = useStores();
  return useQuery(captureQueueQueryOptions(captureQueueStore));
};
