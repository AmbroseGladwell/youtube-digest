import { usageLineTestIds } from "../../newOverview/components/UsageLine/UsageLineTestIds.js";
import { keyPromptNoteTestIds } from "../../apiKeys/components/KeyPromptNote/KeyPromptNoteTestIds.js";

export const homePageTestIds = {
  keyPrompt: keyPromptNoteTestIds("HomePage"),
  usageLine: usageLineTestIds("HomePage"),
  root: "HomePage.root",
  skeleton: "HomePage.skeleton",
  hero: "HomePage.hero",
  urlInput: "HomePage.urlInput",
  generateButton: "HomePage.generateButton",
  validationError: "HomePage.validationError",
  keysNote: "HomePage.keysNote",
  keysSavedLine: "HomePage.keysSavedLine",
  settingsLink: "HomePage.settingsLink",
  separateLibraryNote: "HomePage.separateLibraryNote",
  getExtensionButton: "HomePage.getExtensionButton",
  exampleOverview: "HomePage.exampleOverview",
};
