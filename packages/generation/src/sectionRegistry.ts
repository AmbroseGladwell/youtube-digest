import type { NoteKind } from "@overview/domain";
import { coreSection, processCoreSection } from "./sections/coreSection.js";
import { chaptersSection } from "./sections/chaptersSection.js";
import { filingSection } from "./sections/filingSection.js";
import { verdictSection } from "./sections/verdictSection.js";
import { sellingSection } from "./sections/sellingSection.js";
import { howToApplySection, processHowToApplySection } from "./sections/howToApplySection.js";
import { sourceStepsSection } from "./sections/sourceStepsSection.js";
import { watchAnywaySection } from "./sections/watchAnywaySection.js";
import { recipeSection } from "./sections/recipeSection.js";
import { recipeVideoCoreSection } from "./sections/recipeVideoCoreSection.js";
import type { PromptSection } from "./PromptSection.js";
import type { GenerationInput } from "./GenerationInput.js";

// Every kind takes its sections from this one list, so the note a kind shares with the
// others can't drift apart from theirs (docs/features/overview-generation-decisions.md,
// "The kind check").
const REGISTRY: Record<NoteKind, PromptSection[]> = {
  default: [coreSection, chaptersSection, filingSection, verdictSection, sellingSection, howToApplySection, watchAnywaySection],
  process: [
    processCoreSection,
    chaptersSection,
    filingSection,
    verdictSection,
    sellingSection,
    sourceStepsSection,
    processHowToApplySection,
    watchAnywaySection,
  ],
  recipe: [recipeVideoCoreSection, chaptersSection, filingSection, recipeSection],
};

// With the steps switched off, a process note is written as a default one, so its key points
// and How to apply aren't told to leave steps to a block it won't have (docs/features/source-steps.md).
export const writtenKind = (input: GenerationInput, kind: NoteKind): NoteKind =>
  kind === "process" && !input.sectionsEnabled.steps ? "default" : kind;

export function enabledSections(input: GenerationInput, kind: NoteKind = "default"): PromptSection[] {
  return REGISTRY[writtenKind(input, kind)].filter((section) => section.key === "structural" || input.sectionsEnabled[section.key]);
}
