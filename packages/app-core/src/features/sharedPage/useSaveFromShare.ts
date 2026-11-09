import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createFetchGenerationApi, type GenerationApi } from "@overview/sync";
import { sourceName, type Overview, type SharedOverview, type ShareToken, type Topic } from "@overview/domain";
import { overviewKeys } from "../overviews/overviewKeys.js";
import { useStores } from "../../stores/StoresContext.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { savedFromShare } from "./util/savedFromShare.js";

// A shared copy into the library open now. The share's token goes to the server before the
// copy is saved, so its push is let in uncounted rather than reserving a slot on the
// reader's month (docs/architecture/tiers.md, "Reserving on the reader's own key").
export function useSaveFromShare(): (token: ShareToken, snapshot: SharedOverview, options?: { sample: boolean }) => Promise<Overview> {
  const { overviewStore, transcriptStore } = useStores();
  const queryClient = useQueryClient();
  const apiUrl = useKnownApiUrl();
  const { connection } = useSyncConnection();

  return useCallback(
    async (token, snapshot, options = { sample: false }) => {
      const api = apiUrl === null ? null : createFetchGenerationApi({ baseUrl: apiUrl, token: connection.token });
      const copy = savedFromShare(snapshot.note, options.sample);
      const overview =
        options.sample && api !== null ? { ...copy, topicIds: await sortedInto(api, copy, await overviewStore.listTopics()) } : copy;
      if (api !== null) {
        await api.reserve(overview.id, token).catch(() => undefined);
      }
      await overviewStore.saveOverview(overview);
      // The share carries the transcript (docs/features/sharing.md, "The transcript is in"),
      // and a copy saved without it leaves the Transcript tab empty with no way to fill it:
      // a transcript is keyed by video, so nothing else would ever fetch one for this note.
      if (snapshot.transcript !== null) {
        await transcriptStore.saveTranscript(snapshot.transcript);
      }
      void queryClient.invalidateQueries({ queryKey: overviewKeys.all });
      return overview;
    },
    [overviewStore, transcriptStore, apiUrl, connection.token, queryClient],
  );
}

// A sample is sorted into the reader's own topics where it fits any, on us, as a note they made
// would have been. Without topics, or if the pass fails, it's saved unsorted
// (docs/features/onboarding.md, "Try a sample").
async function sortedInto(api: GenerationApi, overview: Overview, topics: readonly Topic[]): Promise<Overview["topicIds"]> {
  if (topics.length === 0) return [];
  const names = await api
    .topics({
      title: overview.source.title,
      source: sourceName(overview.source),
      inOneLine: overview.recipe?.summary ?? overview.inOneLine,
      keyPoints: overview.keyPoints.map(({ text }) => text),
      topics: topics.map(({ name, description }) => ({ name, description })),
    })
    .then(({ names }) => names)
    .catch((): string[] => []);
  return topics.filter((topic) => names.includes(topic.name)).map((topic) => topic.id);
}
