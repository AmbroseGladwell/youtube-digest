import { expect } from "@playwright/experimental-ct-react";
import { selectionBarTestIds } from "../../src/features/library/components/SelectionBar/SelectionBarTestIds.js";
import { DeleteOverviewsDialogPageObject } from "./DeleteOverviewsDialogPageObject.testHelper.js";
import { PageObject } from "./PageObject.testHelper.js";
import { ProjectPickerPageObject } from "./ProjectPickerPageObject.testHelper.js";
import { SelectionTopicsPickerPageObject } from "./SelectionTopicsPickerPageObject.testHelper.js";

export class SelectionBarPageObject extends PageObject {
  verifyIsShown = (shown: boolean) =>
    this.step(`verifyIsShown ${shown}`, () =>
      shown ? this.expectToBeVisible(selectionBarTestIds.root) : this.expectToHaveCount(selectionBarTestIds.root, 0),
    );

  verifyCountReads = (text: string) =>
    this.step(`verifyCountReads ${text}`, () => expect(this.get(selectionBarTestIds.count)).toHaveText(text));

  verifyActionsAreNamed = (names: string[]) =>
    this.step(`verifyActionsAreNamed ${names.join(", ")}`, async () => {
      const buttons = this.get(selectionBarTestIds.root).getByRole("button");
      await expect(buttons).toHaveCount(names.length);
      for (const [index, name] of names.entries()) await expect(buttons.nth(index)).toHaveAccessibleName(name);
    });

  verifyIsEnabled = (enabled: boolean) =>
    this.step(`verifyIsEnabled ${enabled}`, () =>
      enabled
        ? expect(this.get(selectionBarTestIds.addToProjectButton)).toBeEnabled()
        : expect(this.get(selectionBarTestIds.addToProjectButton)).toBeDisabled(),
    );

  addToProject = (): Promise<ProjectPickerPageObject> =>
    this.step("addToProject", async () => {
      await this.click(selectionBarTestIds.addToProjectButton);
      return new ProjectPickerPageObject(this.testContext).verifyIsShown();
    });

  addToTopic = (): Promise<SelectionTopicsPickerPageObject> =>
    this.step("addToTopic", async () => {
      await this.click(selectionBarTestIds.addToTopicButton);
      return new SelectionTopicsPickerPageObject(this.testContext).verifyIsShown();
    });

  verifyReadReads = (label: string) =>
    this.step(`verifyReadReads ${label}`, () => expect(this.get(selectionBarTestIds.readButton)).toHaveAccessibleName(label));

  toggleRead = () => this.step("toggleRead", () => this.click(selectionBarTestIds.readButton));

  verifyFavouriteIsPressed = (pressed: boolean) =>
    this.step(`verifyFavouriteIsPressed ${pressed}`, () =>
      expect(this.get(selectionBarTestIds.favouriteButton)).toHaveAttribute("aria-pressed", String(pressed)),
    );

  toggleFavourite = () => this.step("toggleFavourite", () => this.click(selectionBarTestIds.favouriteButton));

  removeFromProject = () => this.step("removeFromProject", () => this.click(selectionBarTestIds.removeFromProjectButton));

  delete = (): Promise<DeleteOverviewsDialogPageObject> =>
    this.step("delete", async () => {
      await this.click(selectionBarTestIds.deleteButton);
      return new DeleteOverviewsDialogPageObject(this.testContext).verifyIsShown();
    });
}
