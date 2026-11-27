import { expect } from "@playwright/experimental-ct-react";
import { appSidebarTestIds } from "../../src/shell/AppSidebar/AppSidebarTestIds.js";
import { appShellTestIds } from "../../src/shell/AppShell/AppShellTestIds.js";
import { NewProjectDialogPageObject } from "./NewProjectDialogPageObject.testHelper.js";
import { ManageTopicsDialogPageObject } from "./ManageTopicsDialogPageObject.testHelper.js";
import { NewTopicDialogPageObject } from "./NewTopicDialogPageObject.testHelper.js";
import { PageObject } from "./PageObject.testHelper.js";
import { ProjectHeadPageObject } from "./ProjectHeadPageObject.testHelper.js";
import { ProjectsIndexPageObject } from "./ProjectsIndexPageObject.testHelper.js";
import { TimeSavedSheetPageObject } from "./TimeSavedSheetPageObject.testHelper.js";

export class AppSidebarPageObject extends PageObject {
  private projectRows = () => this.get(appSidebarTestIds.root).getByRole("list", { name: "Projects" }).getByRole("listitem");
  private topicRows = () => this.get(appSidebarTestIds.root).getByRole("list", { name: "Topics" }).getByRole("listitem");

  verifyIsShown = () =>
    this.step("verifyIsShown", async () => {
      await this.expectToBeVisible(appSidebarTestIds.root);
      return this;
    });

  verifyIsHidden = () => this.step("verifyIsHidden", () => this.expectNotToBeVisible(appSidebarTestIds.root));

  verifyIsAbsent = () => this.step("verifyIsAbsent", () => this.expectToHaveCount(appShellTestIds.sidebarSlot, 0));

  verifyCurrentPage = (name: "Overviews" | "Projects" | null) =>
    this.step(`verifyCurrentPage ${name}`, async () => {
      for (const page of ["Overviews", "Projects"] as const) {
        const link = this.get(appSidebarTestIds.page(page));
        await (page === name ? expect(link).toHaveAttribute("aria-current", "page") : expect(link).not.toHaveAttribute("aria-current"));
      }
    });

  openPage = (name: "Overviews" | "Projects") => this.step(`openPage ${name}`, () => this.click(appSidebarTestIds.page(name)));

  clickHide = () => this.step("clickHide", () => this.click(appSidebarTestIds.hide));

  clickShow = () => this.step("clickShow", () => this.click(appShellTestIds.showSidebar));

  verifyShowButtonIsFocused = () =>
    this.step("verifyShowButtonIsFocused", () => expect(this.get(appShellTestIds.showSidebar)).toBeFocused());

  verifyHideButtonIsFocused = () => this.step("verifyHideButtonIsFocused", () => expect(this.get(appSidebarTestIds.hide)).toBeFocused());

  verifyOffersShow = (offers: boolean) =>
    this.step(`verifyOffersShow ${offers}`, () => this.expectToHaveCount(appShellTestIds.showSidebar, offers ? 1 : 0));

  verifyQueueReads = (text: string | null) =>
    this.step(`verifyQueueReads ${text}`, () =>
      text === null ? this.expectToHaveCount(appSidebarTestIds.queue, 0) : expect(this.get(appSidebarTestIds.queue)).toHaveText(text),
    );

  openQueue = () => this.step("openQueue", () => this.click(appSidebarTestIds.queue));

  verifyListsProjects = (names: string[]) =>
    this.step(`verifyListsProjects ${names.join(", ")}`, () =>
      names.length === 0
        ? expect(this.projectRows()).toHaveCount(0)
        : expect(this.projectRows()).toHaveText(names.map((name) => new RegExp(name))),
    );

  verifyRowReads = (name: string, text: string) =>
    this.step(`verifyRowReads ${name}`, () => expect(this.get(appSidebarTestIds.project(name))).toHaveText(text));

  verifyAllProjectsReads = (text: string | null) =>
    this.step(`verifyAllProjectsReads ${text}`, () =>
      text === null
        ? this.expectNotToBeVisible(appSidebarTestIds.allProjects)
        : expect(this.get(appSidebarTestIds.allProjects)).toHaveText(text),
    );

  verifyIsCurrent = (name: string) =>
    this.step(`verifyIsCurrent ${name}`, () => expect(this.get(appSidebarTestIds.project(name))).toHaveAttribute("aria-current", "page"));

  openProject = (name: string): Promise<ProjectHeadPageObject> =>
    this.step(`openProject ${name}`, async () => {
      await this.click(appSidebarTestIds.project(name));
      return new ProjectHeadPageObject(this.testContext).verifyIsShown();
    });

  openAllProjects = (): Promise<ProjectsIndexPageObject> =>
    this.step("openAllProjects", async () => {
      await this.click(appSidebarTestIds.allProjects);
      return new ProjectsIndexPageObject(this.testContext).verifyIsShown();
    });

  clickNewProject = (): Promise<NewProjectDialogPageObject> =>
    this.step("clickNewProject", async () => {
      await this.click(appSidebarTestIds.newProject);
      return new NewProjectDialogPageObject(this.testContext).verifyIsShown();
    });

  verifyListsTopics = (names: string[]) =>
    this.step(`verifyListsTopics ${names.join(", ")}`, () =>
      expect(this.topicRows()).toHaveText(names.map((name) => new RegExp(`^${name}`))),
    );

  verifyTopicNamed = (name: string, spoken: string) =>
    this.step(`verifyTopicNamed ${name}`, () => expect(this.get(appSidebarTestIds.topic(name))).toHaveAttribute("aria-label", spoken));

  verifyTopicIsChosen = (name: string, chosen: boolean) =>
    this.step(`verifyTopicIsChosen ${name} ${chosen}`, () =>
      chosen
        ? expect(this.get(appSidebarTestIds.topic(name))).toHaveAttribute("aria-current", "true")
        : expect(this.get(appSidebarTestIds.topic(name))).not.toHaveAttribute("aria-current"),
    );

  openManageTopics = (): Promise<ManageTopicsDialogPageObject> =>
    this.step("openManageTopics", async () => {
      await this.click(appSidebarTestIds.manageTopics);
      return new ManageTopicsDialogPageObject(this.testContext).verifyIsShown();
    });

  verifyOffersManageTopics = (offers: boolean) =>
    this.step(`verifyOffersManageTopics ${offers}`, () => this.expectToHaveCount(appSidebarTestIds.manageTopics, offers ? 1 : 0));

  chooseTopic = (name: string) => this.step(`chooseTopic ${name}`, () => this.click(appSidebarTestIds.topic(name)));

  verifyShowAllTopicsReads = (text: string | null) =>
    this.step(`verifyShowAllTopicsReads ${text}`, () =>
      text === null
        ? this.expectToHaveCount(appSidebarTestIds.allTopics, 0)
        : expect(this.get(appSidebarTestIds.allTopics)).toHaveText(text),
    );

  clickShowAllTopics = () => this.step("clickShowAllTopics", () => this.click(appSidebarTestIds.allTopics));

  clickNewTopic = (): Promise<NewTopicDialogPageObject> =>
    this.step("clickNewTopic", async () => {
      await this.click(appSidebarTestIds.newTopic);
      return new NewTopicDialogPageObject(this.testContext).verifyIsShown();
    });

  verifyTimeSavedNamed = (name: string) =>
    this.step(`verifyTimeSavedNamed ${name}`, () => expect(this.get(appSidebarTestIds.timeSaved)).toHaveAccessibleName(name));

  openTimeSaved = (): Promise<TimeSavedSheetPageObject> =>
    this.step("openTimeSaved", async () => {
      await this.click(appSidebarTestIds.timeSaved);
      return new TimeSavedSheetPageObject(this.testContext).verifyIsShown();
    });

  verifyRestsOnTheMasthead = () =>
    this.step("verifyRestsOnTheMasthead", () =>
      expect(async () => {
        const masthead = (await this.page.getByTestId(appShellTestIds.masthead).boundingBox())!;
        const sidebar = (await this.get(appSidebarTestIds.root).boundingBox())!;
        expect(Math.round(sidebar.y)).toBe(Math.round(masthead.y + masthead.height));
      }).toPass({ timeout: 2_000 }),
    );

  verifyRuleRunsToTheFoot = () =>
    this.step("verifyRuleRunsToTheFoot", async () => {
      const sidebar = (await this.get(appSidebarTestIds.root).boundingBox())!;
      expect(Math.round(sidebar.y + sidebar.height)).toBeGreaterThanOrEqual(this.page.viewportSize()!.height);
    });
}
