import { coreSection } from "./sections/coreSection.js";
import { filingSection } from "./sections/filingSection.js";
import { verdictSection } from "./sections/verdictSection.js";
import { sellingSection } from "./sections/sellingSection.js";
import { howToApplySection } from "./sections/howToApplySection.js";
import { watchAnywaySection } from "./sections/watchAnywaySection.js";
import type { PromptSection } from "./PromptSection.js";
import type { GenerationInput } from "./GenerationInput.js";

const REGISTRY: PromptSection[] = [
  coreSection,
  filingSection,
  verdictSection,
  sellingSection,
  howToApplySection,
  watchAnywaySection,
];

export function enabledSections(input: GenerationInput): PromptSection[] {
  return REGISTRY.filter(
    (section) => section.key === "structural" || input.sectionsEnabled[section.key],
  );
}
