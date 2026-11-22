import type { ChatSourceKind } from "@overview/domain";

export interface ChatWords {
  noun: string;
  notCovered: string;
  answersFrom: string;
}

// An article or recipe page is answered from its overview alone, so its labels say so (OV-320).
export const chatWords = (about: ChatSourceKind): ChatWords =>
  ({
    video: { noun: "video", notCovered: "Not from the video", answersFrom: "Answers come from the video, with the moments they’re from." },
    episode: {
      noun: "episode",
      notCovered: "Not from the episode",
      answersFrom: "Answers come from the episode, with the moments they’re from.",
    },
    article: {
      noun: "article",
      notCovered: "Not from the overview of this article",
      answersFrom: "Answers come from the overview, not the whole article.",
    },
    recipe: {
      noun: "recipe",
      notCovered: "Not from the recipe",
      answersFrom: "Answers come from the recipe and its overview, not the whole page.",
    },
  })[about];
