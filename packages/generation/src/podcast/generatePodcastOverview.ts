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

// The kind is checked as for a video. A recipe episode gets the default note, since a recipe note
// is built from a page's or a video's stated amounts, which an episode has neither of
// (docs/features/podcast-notes.md).
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
