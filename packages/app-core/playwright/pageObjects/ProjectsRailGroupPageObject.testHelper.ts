import { expect } from "@playwright/experimental-ct-react";
import { filterPanelTestIds } from "../../src/features/library/components/FilterPanel/FilterPanelTestIds.js";
import { projectsRailGroupTestIds } from "../../src/features/projects/components/ProjectsRailGroup/ProjectsRailGroupTestIds.js";
import { NewProjectDialogPageObject } from "./NewProjectDialogPageObject.testHelper.js";
import { PageObject } from "./PageObject.testHelper.js";
import { ProjectHeadPageObject } from "./ProjectHeadPageObject.testHelper.js";
import { ProjectsIndexPageObject } from "./ProjectsIndexPageObject.testHelper.js";

export class ProjectsRailGroupPageObject extends PageObject {
  private rows = () => this.get(projectsRailGroupTestIds.root).getByRole("listitem");

  private measure = (testId: string) =>
    this.get(testId).evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        height: element.getBoundingClientRect().height,
        fontSize: style.fontSize,
        padding: style.padding,
        margin: style.margin,
        borderRadius: style.borderRadius,
        color: style.color,
      };
    });

  verifyRowMatchesTopicRow = (name: string, topicId: string) =>
    this.step(`verifyRowMatchesTopicRow ${name} ${topicId}`, async () => {
      const { height, fontSize, padding } = await this.measure(projectsRailGroupTestIds.project(name));
      const topic = await this.measure(filterPanelTestIds.topicChip(topicId));
      expect({ height, fontSize, padding }).toEqual({ height: topic.height, fontSize: topic.fontSize, padding: topic.padding });
    });

  // "Show all N topics" and New topic share one shape; All projects takes it, underlined.
  verifyAllProjectsIsShapedLikeTheTopicsButtons = () =>
    this.step("verifyAllProjectsIsShapedLikeTheTopicsButtons", async () => {
      expect(await this.measure(projectsRailGroupTestIds.allProjectsLink)).toEqual(await this.measure(filterPanelTestIds.newTopicButton));
      await expect(this.get(projectsRailGroupTestIds.allProjectsLink)).toHaveCSS("text-decoration-line", "underline");
    });

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
