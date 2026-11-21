import { expect } from "@playwright/experimental-ct-react";
import { softWallTestIds } from "../../src/features/newOverview/components/SoftWall/SoftWallTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

// The soft wall at the monthly limit, for a Free or BYO Plus reader (designs 327aa–327ac).
export class SoftWallPageObject extends PageObject {
  verifyIsShown = ({ resetsOn, link }: { resetsOn: string; link: { kicker: string | null; title: string } }) =>
    this.step("verifyIsShown", async () => {
      const wall = this.get(softWallTestIds.root);
      await expect(wall.getByRole("heading", { name: "You’ve hit your overview limit." })).toBeFocused();
      await expect(wall).toContainText(
        `Your overview limit resets on ${resetsOn}. Everything you’ve saved keeps working. Read, listen, search, and ask your AI.`,
      );
      await expect(this.get(softWallTestIds.link)).toHaveText(`The link you pasted${link.kicker ?? ""}${link.title}`);
      await this.expectToBeVisible(softWallTestIds.getPlus);
      await this.expectToBeVisible(softWallTestIds.seePlans);
    });

  verifyIsAbsent = () => this.step("verifyIsAbsent", () => this.expectToHaveCount(softWallTestIds.root, 0));

  verifyOffersAKey = (offered: boolean) =>
    this.step(`verifyOffersAKey ${offered}`, () => this.expectToHaveCount(softWallTestIds.addKey, offered ? 1 : 0));

  addAKey = () => this.step("addAKey", () => this.click(softWallTestIds.addKey));

  getPlus = () => this.step("getPlus", () => this.click(softWallTestIds.getPlus));

  seeEveryPlan = () => this.step("seeEveryPlan", () => this.click(softWallTestIds.seePlans));
}
