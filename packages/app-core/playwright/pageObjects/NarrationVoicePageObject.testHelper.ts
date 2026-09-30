import { narrationVoicePageTestIds } from "../../src/features/settings/NarrationVoicePage/NarrationVoicePageTestIds.js";
import { NarrationVoicePickerPageObject } from "./NarrationVoicePickerPageObject.testHelper.js";
import { PageObject } from "./PageObject.testHelper.js";
import { SettingsPageObject } from "./SettingsPageObject.testHelper.js";

export class NarrationVoicePageObject extends PageObject {
  get voicePicker(): NarrationVoicePickerPageObject {
    return new NarrationVoicePickerPageObject(this.testContext);
  }

  verifyIsShown = (): Promise<NarrationVoicePageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(narrationVoicePageTestIds.root);
      return this;
    });

  clickBackToSettings = (): Promise<SettingsPageObject> =>
    this.step("clickBackToSettings", async () => {
      await this.click(narrationVoicePageTestIds.backLink);
      return new SettingsPageObject(this.testContext).verifyIsShown();
    });
}
