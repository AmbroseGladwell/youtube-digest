import { expect } from "@playwright/experimental-ct-react";
import { projectsIndexTestIds } from "../../src/features/projects/components/ProjectsIndex/ProjectsIndexTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class ProjectsIndexPageObject extends PageObject {
  verifyIsShown = (): Promise<ProjectsIndexPageObject> =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(projectsIndexTestIds.root);
      return this;
    });

  verifySummaryReads = (text: string) =>
    this.step(`verifySummaryReads ${text}`, () => expect(this.get(projectsIndexTestIds.summary)).toHaveText(text));

  verifyCardReads = (name: string, text: RegExp) =>
    this.step(`verifyCardReads ${name}`, () => expect(this.get(projectsIndexTestIds.card(name))).toHaveText(text));

  verifyCardIsShown = (name: string, shown: boolean) =>
    this.step(`verifyCardIsShown ${name} ${shown}`, () =>
      shown ? this.expectToBeVisible(projectsIndexTestIds.card(name)) : this.expectNotToBeVisible(projectsIndexTestIds.card(name)),
    );

  showArchived = () => this.step("showArchived", () => this.click(projectsIndexTestIds.archivedToggle));

  restore = (name: string) => this.step(`restore ${name}`, () => this.click(projectsIndexTestIds.restoreButton(name)));
}
