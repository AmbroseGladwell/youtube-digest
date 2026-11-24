import { queryOptions, useQuery } from "@tanstack/react-query";
import { OverviewId, type CaptureStore, type SavedCapture } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import { captureKeys } from "../captureKeys.js";

export const savedCaptureQueryOptions = (captureStore: CaptureStore, id: string) =>
  queryOptions({
    queryKey: [...captureKeys.all, "saved", id] as const,
    queryFn: async (): Promise<SavedCapture | null> => {
      const parsed = OverviewId.safeParse(id);
      const capture = parsed.success ? await captureStore.getCapture(parsed.data) : null;
      return capture?.stage === "saved" ? capture : null;
    },
  });

export const useSavedCaptureQuery = (id: string) => {
  const { captureStore } = useStores();
  return useQuery(savedCaptureQueryOptions(captureStore, id));
};
