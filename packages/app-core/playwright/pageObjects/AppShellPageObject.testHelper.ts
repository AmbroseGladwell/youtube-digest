import { appShellTestIds } from "../../src/shell/AppShell/AppShellTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";
import { GenerateOverviewFormPageObject } from "./GenerateOverviewFormPageObject.testHelper.js";
import { SettingsPageObject } from "./SettingsPageObject.testHelper.js";

export class AppShellPageObject extends PageObject {
  get generateForm(): GenerateOverviewFormPageObject {
    return new GenerateOverviewFormPageObject(this.testContext);
  }

  clickNewOverview = () =>
    this.step("clickNewOverview", () => this.click(appShellTestIds.newOverviewButton));

  openNewOverview = (): Promise<GenerateOverviewFormPageObject> =>
    this.step("openNewOverview", async () => {
      await this.clickNewOverview();
      return new GenerateOverviewFormPageObject(this.testContext).verifyIsShown();
    });

  openSettings = (): Promise<SettingsPageObject> =>
    this.step("openSettings", async () => {
      await this.click(appShellTestIds.settingsLink);
      return new SettingsPageObject(this.testContext).verifyIsShown();
    });
}
