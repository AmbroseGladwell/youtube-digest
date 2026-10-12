import { modelPickerDialogTestIds } from "../../src/features/settings/components/ModelPickerDialog/ModelPickerDialogTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class ModelPickerDialogPageObject extends PageObject {
  verifyIsShown = (): Promise<ModelPickerDialogPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(modelPickerDialogTestIds.heading);
      return this;
    });

  verifyOffers = (id: string) =>
    this.step(`verifyOffers ${id}`, () => this.expectToBeVisible(modelPickerDialogTestIds.choice(id)));

  chooseModel = (id: string) =>
    this.step(`chooseModel ${id}`, () => this.click(modelPickerDialogTestIds.choice(id)));

  search = (text: string) =>
    this.step(`search ${text}`, () => this.get(modelPickerDialogTestIds.search).fill(text));

  close = () => this.step("close", () => this.click(modelPickerDialogTestIds.close));

  // The provider would not list its models, so the picker shows the ones we know and says
  // so in one muted line. Not an error: the key itself works (design 110h).
  verifyFellBackToKnownModels = () =>
    this.step("verifyFellBackToKnownModels", () => this.expectToBeVisible(modelPickerDialogTestIds.staleNote));

  verifyGroupsTheRest = () =>
    this.step("verifyGroupsTheRest", () => this.expectToBeVisible(modelPickerDialogTestIds.restLabel));
}
