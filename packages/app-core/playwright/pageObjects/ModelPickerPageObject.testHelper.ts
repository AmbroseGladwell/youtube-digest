import { modelPickerPageTestIds } from "../../src/features/settings/ModelPickerPage/ModelPickerPageTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class ModelPickerPageObject extends PageObject {
  verifyIsShown = (): Promise<ModelPickerPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(modelPickerPageTestIds.root);
      return this;
    });

  verifyOffers = (id: string) =>
    this.step(`verifyOffers ${id}`, () => this.expectToBeVisible(modelPickerPageTestIds.choice(id)));

  chooseModel = (id: string) =>
    this.step(`chooseModel ${id}`, () => this.click(modelPickerPageTestIds.choice(id)));

  search = (text: string) =>
    this.step(`search ${text}`, () => this.get(modelPickerPageTestIds.search).fill(text));

  // The provider would not list its models, so the picker shows the ones we know and says
  // so in one muted line. Not an error: the key itself works (design 110h).
  verifyFellBackToKnownModels = () =>
    this.step("verifyFellBackToKnownModels", () => this.expectToBeVisible(modelPickerPageTestIds.staleNote));

  verifyGroupsTheRest = () =>
    this.step("verifyGroupsTheRest", () => this.expectToBeVisible(modelPickerPageTestIds.restLabel));
}
