import type { SectionsEnabled } from "@overview/domain";

export const personalisationSectionTestIds = {
  root: "PersonalisationSection.root",
  stepsOffNote: "PersonalisationSection.stepsOffNote",
  resourcesOffNote: "PersonalisationSection.resourcesOffNote",
  followUpQuestionsOffNote: "PersonalisationSection.followUpQuestionsOffNote",
  switch: (section: keyof SectionsEnabled) => `PersonalisationSection.switch.${section}`,
};
