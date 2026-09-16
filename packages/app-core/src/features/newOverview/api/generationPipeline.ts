import { DEFAULT_SECTIONS_ENABLED, OverviewId, type Overview, type OverviewStore } from "@overview/types";
import { generateOverview, type GenerationClient } from "@overview/generation";
import { fetchTranscript, type TranscriptSourceClient } from "@overview/transcripts";

export type GenerationPhase = "fetching-transcript" | "generating" | "saving";

export interface GenerationPipelineDeps {
  transcriptClient: TranscriptSourceClient;
  generationClient: GenerationClient;
  overviewStore: OverviewStore;
}

export async function runOverviewGeneration(
  url: string,
  deps: GenerationPipelineDeps,
  onPhaseChange?: (phase: GenerationPhase) => void,
): Promise<Overview> {
  onPhaseChange?.("fetching-transcript");
  const fetched = await fetchTranscript(deps.transcriptClient, url);

  onPhaseChange?.("generating");
  const [existingTopics, pastClaims] = await Promise.all([
    deps.overviewStore.listTopics(),
    deps.overviewStore.listClaims(),
  ]);
  const { overview } = await generateOverview(
    deps.generationClient,
    {
      video: fetched.video,
      transcript: fetched.transcript,
      savedNote: null,
      readerContext: null,
      sectionsEnabled: DEFAULT_SECTIONS_ENABLED,
      existingTopics,
      pastClaims,
    },
    { id: OverviewId.parse(crypto.randomUUID()), savedAt: new Date().toISOString() },
  );

  onPhaseChange?.("saving");
  await deps.overviewStore.saveOverview(overview);

  return overview;
}
