import { modelPickerDialogTestIds } from "../../src/features/settings/components/ModelPickerDialog/ModelPickerDialogTestIds.js";
import { bottomSheetTestIds } from "../../src/components/shared/BottomSheet/BottomSheetTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class ModelPickerDialogPageObject extends PageObject {
  verifyIsShown = (): Promise<ModelPickerDialogPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(modelPickerDialogTestIds.root);
      return this;
    });

  verifyOffers = (id: string) => this.step(`verifyOffers ${id}`, () => this.expectToBeVisible(modelPickerDialogTestIds.choice(id)));

  chooseModel = (id: string) => this.step(`chooseModel ${id}`, () => this.click(modelPickerDialogTestIds.choice(id)));

  search = (text: string) => this.step(`search ${text}`, () => this.get(modelPickerDialogTestIds.search).fill(text));

  close = () =>
    this.step("close", async () => {
      await this.click(this.get(modelPickerDialogTestIds.root).getByTestId(bottomSheetTestIds.close));
      await this.expectNotToBeVisible(modelPickerDialogTestIds.root);
    });

  verifyFellBackToKnownModels = () =>
    this.step("verifyFellBackToKnownModels", () => this.expectToBeVisible(modelPickerDialogTestIds.staleNote));

  verifyGroupsTheRest = () => this.step("verifyGroupsTheRest", () => this.expectToBeVisible(modelPickerDialogTestIds.restLabel));
}
