export const whatWeKnowCardTestIds = {
  root: "what-we-know-card",
  sentence: "what-we-know-card-sentence",
  empty: "what-we-know-card-empty",
  open: "what-we-know-card-open",
  meta: "what-we-know-card-meta",
  learnedItem: (text: string) => `what-we-know-card-learned-${text}`,
  learnedRemove: (text: string) => `what-we-know-card-learned-remove-${text}`,
  learnedEmpty: "what-we-know-card-learned-empty",
  keepLearning: "what-we-know-card-keep-learning",
  shareWithAssistants: "what-we-know-card-share-with-assistants",
  clear: "what-we-know-card-clear",
  done: "what-we-know-card-done",
};
