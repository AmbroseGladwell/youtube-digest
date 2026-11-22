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
import { followUpQuestionsSection, recipeFollowUpQuestionsSection } from "./sections/followUpQuestionsSection.js";
import type { PromptSection } from "./PromptSection.js";
import type { GenerationInput } from "./GenerationInput.js";

// One list for every kind: docs/features/overview-generation-decisions.md, "The kind check".
const REGISTRY: Record<NoteKind, PromptSection[]> = {
  default: [
    coreSection,
    chaptersSection,
    filingSection,
    verdictSection,
    sellingSection,
    howToApplySection,
    watchAnywaySection,
    followUpQuestionsSection,
  ],
  process: [
    processCoreSection,
    chaptersSection,
    filingSection,
    verdictSection,
    sellingSection,
    sourceStepsSection,
    processHowToApplySection,
    watchAnywaySection,
    followUpQuestionsSection,
  ],
  recipe: [recipeVideoCoreSection, chaptersSection, filingSection, recipeSection, recipeFollowUpQuestionsSection],
};

// Steps off, a process note is written as a default one: docs/features/source-steps.md, "On the note".
export const writtenKind = (input: GenerationInput, kind: NoteKind): NoteKind =>
  kind === "process" && !input.sectionsEnabled.steps ? "default" : kind;

export const enabledSections = (input: GenerationInput, kind: NoteKind = "default"): PromptSection[] => {
  return REGISTRY[writtenKind(input, kind)].filter((section) => section.key === "structural" || input.sectionsEnabled[section.key]);
};
