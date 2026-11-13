import type { OverviewId, PodcastOverview } from "@overview/domain";
import { assembleOverview } from "../assembleOverview.js";
import type { GeneratedOutput } from "../GeneratedOutput.js";
import { requestGeneratedOutput, type GenerationClient, type GenerationObserver } from "../generateOverview.js";
import { checkNoteKind } from "../noteKind/checkNoteKind.js";
import { kindSampleOfVideo } from "../noteKind/kindSampleOfVideo.js";
import { composePodcastPrompt } from "./composePodcastPrompt.js";
import type { PodcastGenerationInput } from "./PodcastGenerationInput.js";

// The kind is checked as for a video. A recipe episode gets the default note, since a recipe note
// is built from a page's or a video's stated amounts, which an episode has neither of
// (docs/features/podcast-notes.md).
export async function generatePodcastOverview(
  client: GenerationClient,
  input: PodcastGenerationInput,
  meta: { id: OverviewId; savedAt: string },
  observer: GenerationObserver = {},
): Promise<PodcastOverview> {
  const kind = await checkNoteKind(client, kindSampleOfVideo(input));
  observer.kindChecked?.(kind);
  const output = await requestGeneratedOutput<GeneratedOutput>(
    client,
    composePodcastPrompt(input, kind === "process" ? "process" : "default"),
  );
  return { ...assembleOverview(input, output, meta), source: input.podcast };
}
