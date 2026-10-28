import { expect } from "@playwright/experimental-ct-react";
import { firstOverviewMilestoneTestIds } from "../../src/features/timeSaved/components/FirstOverviewMilestone/FirstOverviewMilestoneTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class FirstOverviewMilestonePageObject extends PageObject {
  verifyIsShown = () =>
    this.step("verifyIsShown", async () => {
      await expect(this.get(firstOverviewMilestoneTestIds.root)).toContainText("First overview");
      await expect(this.get(firstOverviewMilestoneTestIds.root)).toContainText("1 made");
    });

  verifyIsAbsent = () => this.step("verifyIsAbsent", () => this.expectNotToBeVisible(firstOverviewMilestoneTestIds.root));

  dismiss = () => this.step("dismiss", () => this.click(firstOverviewMilestoneTestIds.dismiss));
}
