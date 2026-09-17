import { expect } from "@playwright/experimental-ct-react";
import { generationStatusStripTestIds } from "../../src/features/newOverview/components/GenerationStatusStrip/GenerationStatusStripTestIds.js";
import { READY_DISMISS_MS } from "../../src/features/newOverview/components/GenerationStatusStrip/readyDismissMs.js";
import { PageObject } from "./PageObject.testHelper.js";

export class GenerationStatusStripPageObject extends PageObject {
  verifyIsShown = (): Promise<GenerationStatusStripPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(generationStatusStripTestIds.root);
      return this;
    });

  verifyIsHidden = () =>
    this.step("verifyIsHidden", () => this.expectToHaveCount(generationStatusStripTestIds.root, 0));

  verifyReads = (label: string, step: string) =>
    this.step(`verifyReads ${label} / ${step}`, async () => {
      await expect(this.get(generationStatusStripTestIds.label)).toHaveText(label);
      await expect(this.get(generationStatusStripTestIds.step)).toHaveText(new RegExp(`^${step} · \\d+:\\d\\d$`));
    });

  clickDetails = () =>
    this.step("clickDetails", () => this.click(generationStatusStripTestIds.detailsButton));

  clickReadOverview = () =>
    this.step("clickReadOverview", () => this.click(generationStatusStripTestIds.readOverviewButton));

  verifyStandsDownOnItsOwn = () =>
    this.step("verifyStandsDownOnItsOwn", () =>
      expect(this.get(generationStatusStripTestIds.root)).toHaveCount(0, {
        timeout: READY_DISMISS_MS + 5_000,
      }),
    );

  clickDismiss = () => this.step("clickDismiss", () => this.click(generationStatusStripTestIds.dismissButton));
}
