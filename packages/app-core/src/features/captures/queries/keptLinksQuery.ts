import { queryOptions, useQuery } from "@tanstack/react-query";
import type { CaptureStore, KeptCapture } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import { captureKeys } from "../captureKeys.js";

// Links kept from Create, not a playlist's videos: docs/features/kept-links.md, "Kept links".
export const keptLinksQueryOptions = (captureStore: CaptureStore) =>
  queryOptions({
    queryKey: [...captureKeys.all, "kept"] as const,
    queryFn: async (): Promise<KeptCapture[]> =>
      (await captureStore.listCaptures()).filter(
        (capture): capture is KeptCapture => capture.stage === "kept" && capture.fromPlaylist === null,
      ),
  });

export const useKeptLinksQuery = () => {
  const { captureStore } = useStores();
  return useQuery(keptLinksQueryOptions(captureStore));
};
