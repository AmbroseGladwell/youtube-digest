import { expect } from "@playwright/experimental-ct-react";
import { filterPanelTestIds } from "../../src/features/library/components/FilterPanel/FilterPanelTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class FilterPanelPageObject extends PageObject {
  search = (query: string) =>
    this.step(`search ${query}`, () => this.get(filterPanelTestIds.searchInput).fill(query));

  clickNoveltyChip = (novelty: string) =>
    this.step(`clickNoveltyChip ${novelty}`, () => this.click(filterPanelTestIds.noveltyChip(novelty)));

  clickStatusChip = (status: string) =>
    this.step(`clickStatusChip ${status}`, () => this.click(filterPanelTestIds.statusChip(status)));

  // By name rather than by id: a topic the reader has just accepted was minted by the
  // store, so the test never learns its id.
  verifyOffersTopic = (name: string) =>
    this.step(`verifyOffersTopic ${name}`, () =>
      expect(this.topicGroup().getByText(name, { exact: true })).toBeVisible(),
    );

  verifyOffersNoTopics = () =>
    this.step("verifyOffersNoTopics", () => expect(this.topicGroup()).toHaveCount(0));

  private topicGroup = () => this.page.getByRole("group", { name: "Filter by topic" });

  verifyListsTopics = (names: string[]) =>
    this.step(`verifyListsTopics ${names.join(", ")}`, () =>
      expect(this.topicGroup().getByRole("button").filter({ hasNotText: "All topics" })).toHaveText(
        names.map((name) => new RegExp(name)),
      ),
    );

  clickShowAllTopics = () =>
    this.step("clickShowAllTopics", () => this.click(filterPanelTestIds.showAllTopicsButton));

  verifyShowAllReads = (label: string) =>
    this.step(`verifyShowAllReads ${label}`, () =>
      expect(this.get(filterPanelTestIds.showAllTopicsButton)).toHaveText(label),
    );

  verifyOffersNoShowAll = () =>
    this.step("verifyOffersNoShowAll", () =>
      this.expectNotToBeVisible(filterPanelTestIds.showAllTopicsButton),
    );

  clickNewTopic = () => this.step("clickNewTopic", () => this.click(filterPanelTestIds.newTopicButton));

  clickTopicChip = (topicId: string) =>
    this.step(`clickTopicChip ${topicId}`, () => this.click(filterPanelTestIds.topicChip(topicId)));
}
