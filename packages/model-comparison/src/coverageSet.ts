export interface CoverageSource {
  kind: "video" | "article";
  url: string;
  chosenFor: string;
}

// docs/architecture/model-comparison.md, "Coverage".
export const COVERAGE_SET: readonly CoverageSource[] = [
  { kind: "video", url: "https://www.youtube.com/watch?v=Kwl5xfnGXeY", chosenFor: "1 min fitness clip, one idea" },
  { kind: "video", url: "https://www.youtube.com/watch?v=CZoh4DhJB48", chosenFor: "9 min narrated news explainer, politics" },
  { kind: "video", url: "https://www.youtube.com/watch?v=Jab_QOxKEO4", chosenFor: "17 min talking head with worked numbers, finance" },
  { kind: "video", url: "https://www.youtube.com/watch?v=f-Ar8mwm3kQ", chosenFor: "23 min screen-share demonstration, technology" },
  { kind: "video", url: "https://www.youtube.com/watch?v=G9P9D9hptq8", chosenFor: "65 min long interview, judged original" },
  { kind: "video", url: "https://www.youtube.com/watch?v=FpIN6tYC5XM", chosenFor: "97 min Diary of a CEO interview, inequality and politics" },
  { kind: "video", url: "https://www.youtube.com/watch?v=TOk-DUDmN6E", chosenFor: "2 h 22 min parliamentary hearing, many speakers" },
  { kind: "article", url: "https://arstechnica.com/gadgets/2026/10/reddit-will-require-you-to-log-in-eventually-ceo-confirms/", chosenFor: "1 min news report, business" },
  { kind: "article", url: "https://martinfowler.com/bliki/LLM-Voice.html", chosenFor: "5 min opinion essay, writing and AI" },
  { kind: "article", url: "https://smart-interface-design-patterns.com/articles/design-adhd/", chosenFor: "6 min practical guide with headings, design and health" },
  { kind: "article", url: "https://ourworldindata.org/a-history-of-global-living-conditions", chosenFor: "20 min data explainer, development" },
  { kind: "article", url: "https://www.paulgraham.com/startupideas.html", chosenFor: "27 min long essay, startups" },
];
