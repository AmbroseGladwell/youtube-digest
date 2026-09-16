import { filterPanelTestIds } from "../../src/features/library/components/FilterPanel/FilterPanelTestIds.js";
import { PageObject } from "./PageObject.testHelper.js";

export class FilterPanelPageObject extends PageObject {
  search = (query: string) =>
    this.step(`search ${query}`, () => this.get(filterPanelTestIds.searchInput).fill(query));

  clickNoveltyChip = (novelty: string) =>
    this.step(`clickNoveltyChip ${novelty}`, () => this.click(filterPanelTestIds.noveltyChip(novelty)));

  clickStatusChip = (status: string) =>
    this.step(`clickStatusChip ${status}`, () => this.click(filterPanelTestIds.statusChip(status)));

  clickTopicChip = (topicId: string) =>
    this.step(`clickTopicChip ${topicId}`, () => this.click(filterPanelTestIds.topicChip(topicId)));
}
