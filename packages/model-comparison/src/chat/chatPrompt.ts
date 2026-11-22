import type { Passage } from "./transcriptPassages.js";
import { passageBlock } from "./transcriptPassages.js";

export const CHAT_ARMS = ["fullTranscript", "passages", "overviewAndPassages"] as const;
export type ChatArm = (typeof CHAT_ARMS)[number];

const INSTRUCTIONS = `You answer a reader's questions about one video they saved in The Overview.

Answer only from the material below. Never answer from general knowledge, even when you know the answer.
- When the material answers the question, set inSource to true, answer in two to five plain sentences, and list in passages the ids (such as p12) of the transcript passages that support the answer.
- When the material does not say, set inSource to false, say plainly that the video doesn't cover it, and leave passages empty.
- Cite only passage ids that appear in the material.`;

export function chatSystemPrompt(arm: ChatArm, overview: string, passages: readonly Passage[]): string {
  if (arm === "fullTranscript") {
    return `${INSTRUCTIONS}\n\n# The transcript\n\n${passages.map(passageBlock).join("\n")}`;
  }
  if (arm === "overviewAndPassages") {
    return `${INSTRUCTIONS}\n\nEach question comes with the transcript passages closest to it. The overview below is a summary of the whole video, for context; cite passages, not the overview.\n\n# The overview\n\n${overview}`;
  }
  return `${INSTRUCTIONS}\n\nEach question comes with the transcript passages closest to it.`;
}

export function chatUserMessage(arm: ChatArm, question: string, retrieved: readonly Passage[]): string {
  if (arm === "fullTranscript") {
    return question;
  }
  return `# Transcript passages\n\n${retrieved.map(passageBlock).join("\n")}\n\n# Question\n\n${question}`;
}
