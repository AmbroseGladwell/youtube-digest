import { expect } from "@playwright/experimental-ct-react";
import { projectsRailGroupTestIds } from "../../src/features/projects/components/ProjectsRailGroup/ProjectsRailGroupTestIds.js";
import { NewProjectDialogPageObject } from "./NewProjectDialogPageObject.testHelper.js";
import { PageObject } from "./PageObject.testHelper.js";
import { ProjectHeadPageObject } from "./ProjectHeadPageObject.testHelper.js";
import { ProjectsIndexPageObject } from "./ProjectsIndexPageObject.testHelper.js";

export class ProjectsRailGroupPageObject extends PageObject {
  private rows = () => this.get(projectsRailGroupTestIds.root).getByRole("listitem");

  verifyListsProjects = (names: string[]) =>
    this.step(`verifyListsProjects ${names.join(", ")}`, () =>
      names.length === 0 ? expect(this.rows()).toHaveCount(0) : expect(this.rows()).toHaveText(names.map((name) => new RegExp(name))),
    );

  verifyRowReads = (name: string, text: string) =>
    this.step(`verifyRowReads ${name}`, () => expect(this.get(projectsRailGroupTestIds.project(name))).toHaveText(text));

  verifyAllProjectsReads = (text: string | null) =>
    this.step(`verifyAllProjectsReads ${text}`, () =>
      text === null
        ? this.expectNotToBeVisible(projectsRailGroupTestIds.allProjectsLink)
        : expect(this.get(projectsRailGroupTestIds.allProjectsLink)).toHaveText(text),
    );

  verifyIsCurrent = (name: string) =>
    this.step(`verifyIsCurrent ${name}`, () =>
      expect(this.get(projectsRailGroupTestIds.project(name))).toHaveAttribute("aria-current", "page"),
    );

  openProject = (name: string): Promise<ProjectHeadPageObject> =>
    this.step(`openProject ${name}`, async () => {
      await this.click(projectsRailGroupTestIds.project(name));
      return new ProjectHeadPageObject(this.testContext).verifyIsShown();
    });

  openAllProjects = (): Promise<ProjectsIndexPageObject> =>
    this.step("openAllProjects", async () => {
      await this.click(projectsRailGroupTestIds.allProjectsLink);
      return new ProjectsIndexPageObject(this.testContext).verifyIsShown();
    });

  clickNewProject = (): Promise<NewProjectDialogPageObject> =>
    this.step("clickNewProject", async () => {
      await this.click(projectsRailGroupTestIds.newProjectButton);
      return new NewProjectDialogPageObject(this.testContext).verifyIsShown();
    });
}
