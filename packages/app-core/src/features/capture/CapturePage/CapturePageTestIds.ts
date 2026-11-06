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
  alreadyInLibraryNote: "CapturePage.alreadyInLibraryNote",
  noVideoNote: "CapturePage.noVideoNote",
  firstTimeNote: "CapturePage.firstTimeNote",
  askingNote: "CapturePage.askingNote",
  regeneratingNote: "CapturePage.regeneratingNote",
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
