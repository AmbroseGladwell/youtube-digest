import { expect } from "@playwright/experimental-ct-react";
import { sourceHeadTestIds } from "../../src/features/library/components/SourceHead/SourceHeadTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class SourceHeadPageObject extends PageObject {
  verifyIsShown = () =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(sourceHeadTestIds.root);
      return this;
    });

  verifyIsNotShown = () => this.step("verifyIsNotShown", () => this.expectToHaveCount(sourceHeadTestIds.root, 0));

  verifyReads = (head: { name: string; facts: string; site: string | null }) =>
    this.step(`verifyReads ${head.name}`, async () => {
      await expect(this.get(sourceHeadTestIds.title)).toHaveText(head.name);
      await expect(this.get(sourceHeadTestIds.title)).toHaveRole("heading");
      await expect(this.get(sourceHeadTestIds.facts)).toHaveText(head.facts);
      if (head.site === null) {
        await this.expectToHaveCount(sourceHeadTestIds.siteLink, 0);
      } else {
        const site = this.get(sourceHeadTestIds.siteLink);
        await expect(site).toHaveAttribute("href", `https://${head.site}`);
        await expect(site).toHaveAttribute("target", "_blank");
        await expect(site).toHaveAccessibleName(`${head.site}, opens the site`);
      }
    });

  clickBack = () => this.step("clickBack", () => this.click(sourceHeadTestIds.backLink));
}
