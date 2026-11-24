import { expect } from "@playwright/experimental-ct-react";
import { filterMenuTestIds } from "../../src/features/library/components/FilterMenu/FilterMenuTestIds.js";
import { bottomSheetTestIds } from "../../src/components/shared/BottomSheet/BottomSheetTestIds.js";
import { libraryPageTestIds } from "../../src/features/library/LibraryPage/LibraryPageTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";
import { ManageTagsDialogPageObject } from "./ManageTagsDialogPageObject.testHelper.js";

type Fold = "source" | "topic" | "tags" | "verdict";

// Opens the menu, and the folded group a step needs, before acting (design 399o).
export class FilterMenuPageObject extends PageObject {
  private root = () => this.page.getByTestId(filterMenuTestIds.root);

  open = () =>
    this.step("open", async () => {
      if (!(await this.root().isVisible())) {
        await this.page.getByTestId(libraryPageTestIds.filterButton).click();
      }
      await expect(this.root()).toBeVisible();
    });

  close = () =>
    this.step("close", async () => {
      const sheetClose = this.root().getByTestId(bottomSheetTestIds.close);
      if (await sheetClose.isVisible()) {
        await sheetClose.click();
      } else {
        await this.page.keyboard.press("Escape");
      }
      await expect(this.root()).toBeHidden();
    });

  verifyIsOpen = (open: boolean) =>
    this.step(`verifyIsOpen ${open}`, () => (open ? expect(this.root()).toBeVisible() : expect(this.root()).toBeHidden()));

  openFold = (fold: Fold) =>
    this.step(`openFold ${fold}`, async () => {
      await this.open();
      const head = this.page.getByTestId(filterMenuTestIds.fold(fold));
      if ((await head.getAttribute("aria-expanded")) !== "true") {
        await head.click();
      }
      await expect(head).toHaveAttribute("aria-expanded", "true");
    });

  private choose = (group: string, value: string) => this.page.getByTestId(filterMenuTestIds.choice(group, value)).click();

  clickStatusChip = (status: string) =>
    this.step(`clickStatusChip ${status}`, async () => {
      await this.open();
      await this.choose("show", status);
    });

  clickFavouriteChip = () =>
    this.step("clickFavouriteChip", async () => {
      await this.open();
      await this.choose("show", "favourite");
    });

  clickWithoutOverviewChip = () =>
    this.step("clickWithoutOverviewChip", async () => {
      await this.open();
      await this.choose("show", "pending");
    });

  clickAdded = (added: string) =>
    this.step(`clickAdded ${added}`, async () => {
      await this.open();
      await this.choose("added", added);
    });

  clickKind = (kind: string) =>
    this.step(`clickKind ${kind}`, async () => {
      await this.open();
      await this.choose("kind", kind);
    });

  verifyOffersNoKinds = () =>
    this.step("verifyOffersNoKinds", async () => {
      await this.open();
      await expect(this.page.getByTestId(filterMenuTestIds.group("kind"))).toHaveCount(0);
    });

  clickSource = (sourceId: string) =>
    this.step(`clickSource ${sourceId}`, async () => {
      await this.openFold("source");
      await this.choose("source", sourceId);
    });

  clickNoveltyChip = (novelty: string) =>
    this.step(`clickNoveltyChip ${novelty}`, async () => {
      await this.openFold("verdict");
      await this.choose("verdict", novelty);
    });

  clickDubiousChip = () =>
    this.step("clickDubiousChip", async () => {
      await this.openFold("verdict");
      await this.choose("verdict", "dubious");
    });

  verifyFoldReads = (fold: Fold, value: string) =>
    this.step(`verifyFoldReads ${fold} ${value}`, async () => {
      await this.open();
      await expect(this.page.getByTestId(filterMenuTestIds.foldValue(fold))).toHaveText(value);
    });

  verifyFoldIsOpen = (fold: Fold, open: boolean) =>
    this.step(`verifyFoldIsOpen ${fold} ${open}`, () =>
      expect(this.page.getByTestId(filterMenuTestIds.fold(fold))).toHaveAttribute("aria-expanded", String(open)),
    );

  clickTagChip = (tag: string) =>
    this.step(`clickTagChip ${tag}`, async () => {
      await this.openFold("tags");
      await this.choose("tags", tag);
    });

  private tagGroup = () => this.page.getByRole("group", { name: "Tags" });

  verifyListsTags = (tags: string[]) =>
    this.step(`verifyListsTags ${tags.join(", ")}`, async () => {
      await this.openFold("tags");
      await expect(this.tagGroup().locator("label")).toHaveText(tags);
    });

  verifyOffersNoTags = () =>
    this.step("verifyOffersNoTags", async () => {
      await this.open();
      await expect(this.page.getByTestId(filterMenuTestIds.group("tags"))).toHaveCount(0);
    });

  openManageTags = (): Promise<ManageTagsDialogPageObject> =>
    this.step("openManageTags", async () => {
      await this.openFold("tags");
      await this.click(this.page.getByTestId(filterMenuTestIds.manageTags));
      return new ManageTagsDialogPageObject(this.testContext).verifyIsShown();
    });

  verifyOffersNoManageTags = () =>
    this.step("verifyOffersNoManageTags", async () => {
      await this.open();
      await expect(this.page.getByTestId(filterMenuTestIds.manageTags)).toHaveCount(0);
    });

  clickShowAllTags = () =>
    this.step("clickShowAllTags", async () => {
      await this.openFold("tags");
      await this.click(this.page.getByTestId(filterMenuTestIds.showAll("tags")));
    });

  private topicGroup = () => this.page.getByRole("group", { name: "Topic" });

  clickTopicChip = (topicId: string) =>
    this.step(`clickTopicChip ${topicId}`, async () => {
      await this.openFold("topic");
      await this.choose("topic", topicId);
    });

  // By name: a topic just accepted was minted by the store, so the test never learns its id.
  verifyOffersTopic = (name: string) =>
    this.step(`verifyOffersTopic ${name}`, async () => {
      await this.openFold("topic");
      await expect(this.topicGroup().getByText(name, { exact: true })).toBeVisible();
    });

  verifyListsTopics = (names: string[]) =>
    this.step(`verifyListsTopics ${names.join(", ")}`, async () => {
      await this.openFold("topic");
      await expect(
        this.topicGroup()
          .locator("label")
          .filter({ hasNotText: /^(All topics|No topic)/ }),
      ).toHaveText(names.map((name) => new RegExp(`^${name}`)));
    });

  verifyOffersNoTopics = () =>
    this.step("verifyOffersNoTopics", async () => {
      await this.openFold("topic");
      await expect(
        this.topicGroup()
          .locator("label")
          .filter({ hasNotText: /^(All topics|No topic)/ }),
      ).toHaveCount(0);
    });

  clickShowAllTopics = () =>
    this.step("clickShowAllTopics", async () => {
      await this.openFold("topic");
      await this.click(this.page.getByTestId(filterMenuTestIds.showAll("topic")));
    });

  verifyShowAllReads = (label: string) =>
    this.step(`verifyShowAllReads ${label}`, () => expect(this.page.getByTestId(filterMenuTestIds.showAll("topic"))).toHaveText(label));

  verifyOffersNoShowAll = () =>
    this.step("verifyOffersNoShowAll", async () => {
      await this.openFold("topic");
      await expect(this.page.getByTestId(filterMenuTestIds.showAll("topic"))).toHaveCount(0);
    });

  clickNewTopic = () =>
    this.step("clickNewTopic", async () => {
      await this.openFold("topic");
      await this.click(this.page.getByTestId(filterMenuTestIds.newTopic));
    });

  reset = () =>
    this.step("reset", async () => {
      await this.open();
      await this.click(this.page.getByTestId(filterMenuTestIds.reset));
    });

  verifyCountReads = (text: string) =>
    this.step(`verifyCountReads ${text}`, () => expect(this.page.getByTestId(filterMenuTestIds.count)).toHaveText(text));

  showResults = (label: string) =>
    this.step(`showResults ${label}`, async () => {
      const button = this.page.getByTestId(filterMenuTestIds.showResults);
      await expect(button).toHaveText(label);
      await button.click();
      await expect(this.root()).toBeHidden();
    });
}
