import type { NoteKind, Overview, ProjectId } from "@overview/domain";
import type { GenerationInput } from "./GenerationInput.js";
import type { GeneratedOutput, GeneratedRecipeVideoOutput } from "./GeneratedOutput.js";
import { composePrompt } from "./composePrompt.js";
import { assembleOverview, assembleRecipeVideoOverview } from "./assembleOverview.js";
import { checkNoteKind } from "./noteKind/checkNoteKind.js";
import { kindSampleOfVideo } from "./noteKind/kindSampleOfVideo.js";
import { requestGeneratedOutput, type GenerationClient } from "./requestGeneratedOutput.js";
import { filedProjectIds } from "./sections/projectInstructions.js";
import type { OverviewMeta } from "./OverviewMeta.js";

// Lets a caller tell the kind check's calls apart from the note's, so each can be costed on
// its own (docs/architecture/unit-economics.md).
export interface GenerationObserver {
  kindChecked?(kind: NoteKind): void;
  // Which of the reader's projects the overview was filed into. Beside the overview rather than
  // on it, since an overview never lists its projects (docs/features/projects.md).
  projectsFiled?(projectIds: ProjectId[]): void;
}

// The kind is decided first, so the note's schema carries only that kind's sections; a
// recipe the video turns out not to hold falls back to the default note, and a process note is the
// default one with the steps the source gives
// (docs/features/overview-generation-decisions.md, "The kind check").
export const generateOverview = async (
  client: GenerationClient,
  input: GenerationInput,
  meta: OverviewMeta,
  observer: GenerationObserver = {},
): Promise<Overview> => {
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
