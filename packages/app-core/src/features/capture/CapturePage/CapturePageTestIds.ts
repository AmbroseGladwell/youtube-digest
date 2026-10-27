import { limitMessageNoteTestIds } from "../../newOverview/components/LimitMessageNote/LimitMessageNoteTestIds.js";
import { usageLineTestIds } from "../../newOverview/components/UsageLine/UsageLineTestIds.js";
import { keyPromptNoteTestIds } from "../../apiKeys/components/KeyPromptNote/KeyPromptNoteTestIds.js";

export const capturePageTestIds = {
  keyPrompt: keyPromptNoteTestIds("CapturePage"),
  usageLine: usageLineTestIds("CapturePage"),
  limitMessage: limitMessageNoteTestIds("CapturePage"),
  root: "CapturePage.root",
  opening: "CapturePage.opening",
  createButton: "CapturePage.createButton",
  readOverviewButton: "CapturePage.readOverviewButton",
  createAgainButton: "CapturePage.createAgainButton",
  alreadyInLibraryNote: "CapturePage.alreadyInLibraryNote",
  signedOutNote: "CapturePage.signedOutNote",
  noVideoNote: "CapturePage.noVideoNote",
  captionsNote: "CapturePage.captionsNote",
  keysNote: "CapturePage.keysNote",
  working: "CapturePage.working",
  workingTitle: "CapturePage.workingTitle",
  workingChannel: "CapturePage.workingChannel",
  elapsed: "CapturePage.elapsed",
  cancelButton: "CapturePage.cancelButton",
  startAgainButton: "CapturePage.startAgainButton",
  keepOpenNote: "CapturePage.keepOpenNote",
  error: "CapturePage.error",
};
