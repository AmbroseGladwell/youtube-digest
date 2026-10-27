import type { SectionsEnabled } from "@overview/domain";

export const personalisationSectionTestIds = {
  root: "PersonalisationSection.root",
  switch: (section: keyof SectionsEnabled) => `PersonalisationSection.switch.${section}`,
};
