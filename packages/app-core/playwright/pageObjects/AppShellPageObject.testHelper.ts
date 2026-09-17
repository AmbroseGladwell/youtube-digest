import { appShellTestIds } from "../../src/shell/AppShell/AppShellTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";
import { GenerateOverviewFormPageObject } from "./GenerateOverviewFormPageObject.testHelper.js";
import { GenerationStatusStripPageObject } from "./GenerationStatusStripPageObject.testHelper.js";
import { NewOverviewDialogPageObject } from "./NewOverviewDialogPageObject.testHelper.js";
import { SettingsPageObject } from "./SettingsPageObject.testHelper.js";

export class AppShellPageObject extends PageObject {
  get generateForm(): GenerateOverviewFormPageObject {
    return new GenerateOverviewFormPageObject(this.testContext);
  }

  get newOverviewDialog(): NewOverviewDialogPageObject {
    return new NewOverviewDialogPageObject(this.testContext);
  }

  get generationStatusStrip(): GenerationStatusStripPageObject {
    return new GenerationStatusStripPageObject(this.testContext);
  }

  clickNewOverview = () =>
    this.step("clickNewOverview", () => this.click(appShellTestIds.newOverviewButton));

  openNewOverview = (): Promise<NewOverviewDialogPageObject> =>
    this.step("openNewOverview", async () => {
      await this.clickNewOverview();
      return this.newOverviewDialog.verifyIsShown();
    });

  openSettings = (): Promise<SettingsPageObject> =>
    this.step("openSettings", async () => {
      await this.click(appShellTestIds.settingsLink);
      return new SettingsPageObject(this.testContext).verifyIsShown();
    });
}
