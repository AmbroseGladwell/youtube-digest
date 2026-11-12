import type { SectionsEnabled } from "@overview/domain";

export const personalisationSectionTestIds = {
  root: "PersonalisationSection.root",
  stepsOffNote: "PersonalisationSection.stepsOffNote",
  resourcesOffNote: "PersonalisationSection.resourcesOffNote",
  switch: (section: keyof SectionsEnabled) => `PersonalisationSection.switch.${section}`,
};
