import { STARTER_TOPICS } from "./starterTopics.js";

const SUGGESTED_AT_MOST = 3;
const TITLE_WEIGHT = 2;
const ENOUGH = 2;

const escaped = (term: string) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const mentions = (text: string, term: string) => new RegExp(`\\b${escaped(term)}(?:s|es)?\\b`, "i").test(text);

const termScore = (title: string, text: string, term: string): number => {
  if (mentions(title, term)) {
    return TITLE_WEIGHT;
  }
  return mentions(text, term) ? 1 : 0;
};

// Matched in code, free and instant, so it costs no call before an account (OV-176).
export const suggestStarterTopics = (title: string, text: string): string[] => {
  return STARTER_TOPICS.map((topic, order) => {
    const terms = [topic.name, ...topic.keywords];
    const score = terms.reduce((sum, term) => sum + termScore(title, text, term), 0);
    return { name: topic.name, score, order };
  })
    .filter(({ score }) => score >= ENOUGH)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, SUGGESTED_AT_MOST)
    .map(({ name }) => name);
};
