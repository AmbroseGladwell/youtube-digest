import type { NoteKind, Overview, ProjectId } from "@overview/domain";
import type { GenerationInput } from "./GenerationInput.js";
import type { GeneratedOutput, GeneratedRecipeVideoOutput } from "./GeneratedOutput.js";
import { composePrompt } from "./composePrompt.js";
import { assembleOverview, assembleRecipeVideoOverview } from "./assembleOverview.js";
import { checkNoteKind } from "./noteKind/checkNoteKind.js";
import { kindSampleOfVideo } from "./noteKind/kindSampleOfVideo.js";
import { requestGeneratedOutput, type GenerationClient } from "./requestGeneratedOutput.js";
import { filedProjectIds } from "./sections/projectInstructions.js";
import { refuseWithoutSpeech } from "./sections/transcriptBudget.js";
import type { OverviewMeta } from "./OverviewMeta.js";

// Costed apart: docs/architecture/unit-economics.md, "What is recorded".
export interface GenerationObserver {
  kindChecked?(kind: NoteKind): void;
  // Beside the overview, never on it: docs/features/projects.md, "Filing as an overview is made".
  projectsFiled?(projectIds: ProjectId[]): void;
}

// Why the kind goes first: docs/features/overview-generation-decisions.md, "The kind check".
export const generateOverview = async (
  client: GenerationClient,
  input: GenerationInput,
  meta: OverviewMeta,
  observer: GenerationObserver = {},
): Promise<Overview> => {
  refuseWithoutSpeech(input);
  const kind = input.noteKind ?? (await checkNoteKind(client, kindSampleOfVideo(input)));
  observer.kindChecked?.(kind);
  if (kind === "recipe") {
    const output = await requestGeneratedOutput<GeneratedRecipeVideoOutput>(client, composePrompt(input, "recipe"));
    const overview = assembleRecipeVideoOverview(input, output, meta);
    if (overview !== null) {
      observer.projectsFiled?.(filedProjectIds(input.existingProjects, output.matchedProjectNames));
      return overview;
    }
  }
  const noteKind = kind === "process" ? "process" : "default";
  const output = await requestGeneratedOutput<GeneratedOutput>(client, composePrompt(input, noteKind));
  observer.projectsFiled?.(filedProjectIds(input.existingProjects, output.matchedProjectNames));
  return assembleOverview(input, output, meta);
};
