import { settingsPageTestIds } from "../../src/features/settings/SettingsPage/SettingsPageTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";
import { ApiKeysPanelPageObject } from "./ApiKeysPanelPageObject.testHelper.js";

export class SettingsPageObject extends PageObject {
  get apiKeysPanel(): ApiKeysPanelPageObject {
    return new ApiKeysPanelPageObject(this.testContext);
  }

  verifyIsShown = (): Promise<SettingsPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(settingsPageTestIds.root);
      return this;
    });

  verifySavedConfirmation = () =>
    this.step("verifySavedConfirmation", () => this.expectToBeVisible(settingsPageTestIds.savedConfirmation));

  clickBackToOverviews = () =>
    this.step("clickBackToOverviews", () => this.click(settingsPageTestIds.backLink));
}
