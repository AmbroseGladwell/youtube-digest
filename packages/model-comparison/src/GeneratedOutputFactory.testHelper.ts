import type { GeneratedOutput } from "@overview/generation";

export function makeGeneratedOutput(overrides: Partial<GeneratedOutput> = {}): GeneratedOutput {
  return {
    inOneLine: "A thrift channel tests a grocery budget for three months.",
    coreClaim: "Planning meals cut the grocery bill from $1,200 to 960 a month.",
    thin: false,
    keyPoints: [
      { text: "Planning a week of meals first cut the bill.", range: { startSegmentIndex: 3, endSegmentIndex: 5 } },
      { text: "Buying store brands saved the most.", range: null },
      { text: "Shopping once a week stopped impulse buys.", range: { startSegmentIndex: 10, endSegmentIndex: 12 } },
    ],
    chapters: [
      { title: "The starting budget", summary: "What they spent before.", startSegmentIndex: 0 },
      { title: "Meal planning", summary: "How the plan worked.", startSegmentIndex: 10 },
      { title: "The result", summary: "What they spent after.", startSegmentIndex: 20 },
    ],
    matchedTopicNames: [],
    suggestedTopic: null,
    tags: ["budgeting", "groceries", "frugality"],
    verdict: {
      novelty: "common_knowledge",
      standsOut: null,
      dubiousClaims: [],
      reasoning: "Meal planning and store brands are standard budgeting advice.",
      similarToIndices: [],
    },
    selling: { type: "none", detail: "Nothing is sold.", compromisesContent: false },
    howToApply: { items: ["Plan a week of meals before shopping."] },
    watchAnyway: { answer: "no", reason: "The overview covers it.", range: null },
    ...overrides,
  };
}
