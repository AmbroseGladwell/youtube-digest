import type { SectionsEnabled } from "@overview/domain";

export const personalisationSectionTestIds = {
  root: "PersonalisationSection.root",
  stepsOffNote: "PersonalisationSection.stepsOffNote",
  resourcesOffNote: "PersonalisationSection.resourcesOffNote",
  followUpQuestionsOffNote: "PersonalisationSection.followUpQuestionsOffNote",
  followUpAssistantNote: "PersonalisationSection.followUpAssistantNote",
  connectionsLink: "PersonalisationSection.connectionsLink",
  switch: (section: keyof SectionsEnabled) => `PersonalisationSection.switch.${section}`,
  projectFilingCard: "PersonalisationSection.projectFilingCard",
  projectFilingSwitch: "PersonalisationSection.projectFilingSwitch",
};
