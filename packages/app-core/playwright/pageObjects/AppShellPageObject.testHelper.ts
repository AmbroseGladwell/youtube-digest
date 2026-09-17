import { appShellTestIds } from "../../src/shell/AppShell/AppShellTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";
import { GenerateOverviewFormPageObject } from "./GenerateOverviewFormPageObject.testHelper.js";
import { SettingsPageObject } from "./SettingsPageObject.testHelper.js";

export class AppShellPageObject extends PageObject {
  get generateForm(): GenerateOverviewFormPageObject {
    return new GenerateOverviewFormPageObject(this.testContext);
  }

  openSettings = (): Promise<SettingsPageObject> =>
    this.step("openSettings", async () => {
      await this.click(appShellTestIds.settingsLink);
      return new SettingsPageObject(this.testContext).verifyIsShown();
    });
}
