import type { SectionsEnabled } from "@overview/domain";

export const personalisationSectionTestIds = {
  root: "PersonalisationSection.root",
  stepsOffNote: "PersonalisationSection.stepsOffNote",
  switch: (section: keyof SectionsEnabled) => `PersonalisationSection.switch.${section}`,
};
