import { STARTER_TOPICS } from "./starterTopics.js";

const SUGGESTED_AT_MOST = 3;
const TITLE_WEIGHT = 2;
const ENOUGH = 2;

const escaped = (term: string) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const mentions = (text: string, term: string) => new RegExp(`\\b${escaped(term)}(?:s|es)?\\b`, "i").test(text);

// The starter topics a source looks like it belongs under, from its title and text, matched in
// code: free and instant, so suggesting costs no call before an account (OV-176). A word in the
// title counts double; a topic needs a title word, or two words in the text, to be offered.
export function suggestStarterTopics(title: string, text: string): string[] {
  return STARTER_TOPICS.map((topic, order) => {
    const terms = [topic.name, ...topic.keywords];
    const score = terms.reduce((sum, term) => sum + (mentions(title, term) ? TITLE_WEIGHT : mentions(text, term) ? 1 : 0), 0);
    return { name: topic.name, score, order };
  })
    .filter(({ score }) => score >= ENOUGH)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, SUGGESTED_AT_MOST)
    .map(({ name }) => name);
}
