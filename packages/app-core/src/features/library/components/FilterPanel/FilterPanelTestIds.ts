export const filterPanelTestIds = {
  root: "FilterPanel.root",
  topicChip: (topicId: string) => `FilterPanel.topicChip.${topicId}`,
  noveltyChip: (novelty: string) => `FilterPanel.noveltyChip.${novelty}`,
  statusChip: (status: string) => `FilterPanel.statusChip.${status}`,
  favouriteChip: "FilterPanel.favouriteChip",
  newTopicButton: "FilterPanel.newTopicButton",
  showAllTopicsButton: "FilterPanel.showAllTopicsButton",
  dubiousChip: "FilterPanel.dubiousChip",
  tagChip: (tag: string) => `FilterPanel.tagChip.${tag}`,
  showAllTagsButton: "FilterPanel.showAllTagsButton",
  moreFiltersButton: "FilterPanel.moreFiltersButton",
  moreFiltersSummary: "FilterPanel.moreFiltersSummary",
};
