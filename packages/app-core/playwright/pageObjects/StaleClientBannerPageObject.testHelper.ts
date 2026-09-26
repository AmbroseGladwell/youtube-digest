import { expect } from "@playwright/experimental-ct-react";
import { staleClientBannerTestIds } from "../../src/features/sync/components/StaleClientBanner/StaleClientBannerTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class StaleClientBannerPageObject extends PageObject {
  verifyIsShown = (): Promise<StaleClientBannerPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(staleClientBannerTestIds.root);
      return this;
    });

  verifyIsAbsent = () =>
    this.step("verifyIsAbsent", () => this.expectToHaveCount(staleClientBannerTestIds.root, 0));

  verifyMessageReads = (message: string) =>
    this.step(`verifyMessageReads ${message}`, () =>
      expect(this.get(staleClientBannerTestIds.message)).toHaveText(message),
    );

  verifyOffersUpdate = (label: string) =>
    this.step(`verifyOffersUpdate ${label}`, () =>
      expect(this.get(staleClientBannerTestIds.updateButton)).toHaveText(label),
    );

  verifyOffersNoUpdate = () =>
    this.step("verifyOffersNoUpdate", () => this.expectToHaveCount(staleClientBannerTestIds.updateButton, 0));

  dismiss = () => this.step("dismiss", () => this.click(staleClientBannerTestIds.dismissButton));
}
