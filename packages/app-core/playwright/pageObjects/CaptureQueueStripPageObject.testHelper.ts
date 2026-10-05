import { expect } from "@playwright/experimental-ct-react";
import { captureQueueStripViewTestIds } from "../../src/features/captureQueue/components/CaptureQueueStripView/CaptureQueueStripViewTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

// The queue's strip in the generation strip's slot (design 27k).
export class CaptureQueueStripPageObject extends PageObject {
  verifyReads = (title: string | RegExp, meta?: string | RegExp) =>
    this.step(`verifyReads ${String(title)}`, async () => {
      await expect(this.get(captureQueueStripViewTestIds.title)).toHaveText(title);
      if (meta !== undefined) await expect(this.get(captureQueueStripViewTestIds.meta)).toHaveText(meta);
    });

  verifyIsAbsent = () => this.step("verifyIsAbsent", () => this.expectToHaveCount(captureQueueStripViewTestIds.root, 0));

  pause = () => this.step("pause", () => this.click(captureQueueStripViewTestIds.pauseButton));

  resume = () => this.step("resume", () => this.click(captureQueueStripViewTestIds.resumeButton));

  openQueue = () => this.step("openQueue", () => this.click(captureQueueStripViewTestIds.queueLink));

  addKey = () => this.step("addKey", () => this.click(captureQueueStripViewTestIds.addKeyLink));

  unfold = () => this.step("unfold", () => this.click(captureQueueStripViewTestIds.showQueueButton));

  dismiss = () => this.step("dismiss", () => this.click(captureQueueStripViewTestIds.dismissButton));
}
