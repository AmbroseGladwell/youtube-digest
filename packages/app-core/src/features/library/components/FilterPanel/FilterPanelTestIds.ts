export const filterPanelTestIds = {
  root: "FilterPanel.root",
  searchInput: "FilterPanel.searchInput",
  topicChip: (topicId: string) => `FilterPanel.topicChip.${topicId}`,
  noveltyChip: (novelty: string) => `FilterPanel.noveltyChip.${novelty}`,
  statusChip: (status: string) => `FilterPanel.statusChip.${status}`,
  favouriteChip: "FilterPanel.favouriteChip",
  newTopicButton: "FilterPanel.newTopicButton",
  showAllTopicsButton: "FilterPanel.showAllTopicsButton",
  dubiousChip: "FilterPanel.dubiousChip",
};
