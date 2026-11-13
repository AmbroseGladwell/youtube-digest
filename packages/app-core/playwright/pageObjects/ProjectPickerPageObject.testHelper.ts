import { expect } from "@playwright/experimental-ct-react";
import { projectPickerTestIds } from "../../src/features/projects/components/ProjectPicker/ProjectPickerTestIds.js";
import { NewProjectDialogPageObject } from "./NewProjectDialogPageObject.testHelper.js";
import { PageObject } from "./PageObject.testHelper.js";

export class ProjectPickerPageObject extends PageObject {
  verifyIsShown = (): Promise<ProjectPickerPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(projectPickerTestIds.root);
      return this;
    });

  verifyIsNotShown = () => this.step("verifyIsNotShown", () => this.expectNotToBeVisible(projectPickerTestIds.root));

  verifyOffers = (names: string[]) =>
    this.step(`verifyOffers ${names.join(", ")}`, () =>
      expect(this.get(projectPickerTestIds.root).getByRole("checkbox")).toHaveCount(names.length),
    );

  verifyIsTicked = (name: string, ticked: boolean) =>
    this.step(`verifyIsTicked ${name} ${ticked}`, () =>
      expect(this.get(projectPickerTestIds.option(name)).getByRole("checkbox")).toBeChecked({ checked: ticked }),
    );

  verifyIsMixed = (name: string) =>
    this.step(`verifyIsMixed ${name}`, () => expect(this.get(projectPickerTestIds.option(name))).toHaveAttribute("data-state", "some"));

  verifyHeadingReads = (text: string) =>
    this.step(`verifyHeadingReads ${text}`, () => expect(this.get(projectPickerTestIds.root).getByRole("heading")).toHaveText(text));

  verifyFindIsOffered = (offered: boolean) =>
    this.step(`verifyFindIsOffered ${offered}`, () =>
      offered ? this.expectToBeVisible(projectPickerTestIds.findInput) : this.expectNotToBeVisible(projectPickerTestIds.findInput),
    );

  find = (text: string) => this.step(`find ${text}`, () => this.get(projectPickerTestIds.findInput).fill(text));

  tick = (name: string) => this.step(`tick ${name}`, () => this.click(projectPickerTestIds.option(name)));

  verifyFootReads = (text: string) =>
    this.step(`verifyFootReads ${text}`, () => expect(this.get(projectPickerTestIds.foot)).toHaveText(text));

  clickNewProject = (): Promise<NewProjectDialogPageObject> =>
    this.step("clickNewProject", async () => {
      await this.click(projectPickerTestIds.newProjectButton);
      return new NewProjectDialogPageObject(this.testContext).verifyIsShown();
    });

  clickDone = () => this.step("clickDone", () => this.click(projectPickerTestIds.doneButton));
}
