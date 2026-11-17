import type { ChatSourceKind } from "@overview/domain";

export interface ChatWords {
  // "Ask about this article", "conversations about this recipe".
  noun: string;
  // The muted label on an answer that cites nothing (310m), and how it is announced.
  notCovered: string;
  // The empty conversation's second line (310i).
  answersFrom: string;
}

// Chat's copy for what it is about. An article or a recipe page is answered from its overview
// alone, so its labels say so rather than "Not in the article" (OV-320).
export const chatWords = (about: ChatSourceKind): ChatWords =>
  ({
    video: { noun: "video", notCovered: "Not in the video", answersFrom: "Answers come from the video, with the moments they’re from." },
    episode: {
      noun: "episode",
      notCovered: "Not in the episode",
      answersFrom: "Answers come from the episode, with the moments they’re from.",
    },
    article: {
      noun: "article",
      notCovered: "Not in the overview of this article",
      answersFrom: "Answers come from the overview, not the whole article.",
    },
    recipe: {
      noun: "recipe",
      notCovered: "Not in the recipe",
      answersFrom: "Answers come from the recipe and its overview, not the whole page.",
    },
  })[about];
