import type { AboutYouSection } from "@overview/domain";

export const aboutYouSentenceTestIds = {
  root: "AboutYouSentence.root",
  section: (section: AboutYouSection) => `AboutYouSentence.section.${section}`,
};
