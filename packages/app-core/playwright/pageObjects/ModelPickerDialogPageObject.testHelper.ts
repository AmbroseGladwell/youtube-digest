import { modelPickerDialogTestIds } from "../../src/features/settings/components/ModelPickerDialog/ModelPickerDialogTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class ModelPickerDialogPageObject extends PageObject {
  verifyIsShown = (): Promise<ModelPickerDialogPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(modelPickerDialogTestIds.heading);
      return this;
    });

  verifyOffers = (id: string) => this.step(`verifyOffers ${id}`, () => this.expectToBeVisible(modelPickerDialogTestIds.choice(id)));

  chooseModel = (id: string) => this.step(`chooseModel ${id}`, () => this.click(modelPickerDialogTestIds.choice(id)));

  search = (text: string) => this.step(`search ${text}`, () => this.get(modelPickerDialogTestIds.search).fill(text));

  close = () => this.step("close", () => this.click(modelPickerDialogTestIds.close));

  verifyFellBackToKnownModels = () =>
    this.step("verifyFellBackToKnownModels", () => this.expectToBeVisible(modelPickerDialogTestIds.staleNote));

  verifyGroupsTheRest = () => this.step("verifyGroupsTheRest", () => this.expectToBeVisible(modelPickerDialogTestIds.restLabel));
}
