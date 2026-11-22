import type { PodcastOverview } from "@overview/domain";
import { assembleOverview } from "../assembleOverview.js";
import type { GeneratedOutput } from "../GeneratedOutput.js";
import { type GenerationObserver } from "../generateOverview.js";
import { requestGeneratedOutput, type GenerationClient } from "../requestGeneratedOutput.js";
import { checkNoteKind } from "../noteKind/checkNoteKind.js";
import { kindSampleOfVideo } from "../noteKind/kindSampleOfVideo.js";
import { composePodcastPrompt } from "./composePodcastPrompt.js";
import { filedProjectIds } from "../sections/projectInstructions.js";
import type { PodcastGenerationInput } from "./PodcastGenerationInput.js";
import type { OverviewMeta } from "../OverviewMeta.js";

// No recipe note for an episode: docs/features/podcast-notes.md, "The kind check".
export const generatePodcastOverview = async (
  client: GenerationClient,
  input: PodcastGenerationInput,
  meta: OverviewMeta,
  observer: GenerationObserver = {},
): Promise<PodcastOverview> => {
  const kind = await checkNoteKind(client, kindSampleOfVideo(input));
  observer.kindChecked?.(kind);
  const output = await requestGeneratedOutput<GeneratedOutput>(
    client,
    composePodcastPrompt(input, kind === "process" ? "process" : "default"),
  );
  observer.projectsFiled?.(filedProjectIds(input.existingProjects, output.matchedProjectNames));
  return { ...assembleOverview(input, output, meta), source: input.podcast };
};
