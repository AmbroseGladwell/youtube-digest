import type { ChatQuestionInput, ChatStreamEvent, ChatUsage } from "@overview/domain";

export type ChatOutcome = Extract<ChatStreamEvent, { type: "answered" | "failed" }>;
// What arrives while an answer is written, besides its text: the other overviews the question
// added, and each section once it is whole (OV-354).
export type ChatProgress = Extract<ChatStreamEvent, { type: "sources" | "section" | "picking" | "picked" }>;

// Asking about an overview on our server: the answer streams to `onText` as it is written,
// then settles as stored or failed. A refusal before it starts (a wait, a full conversation,
// no transcript) throws the API's own error (docs/features/chats.md, "Asking").
export interface ChatApi {
  ask(
    overviewId: string,
    question: ChatQuestionInput,
    onText: (text: string) => void,
    signal?: AbortSignal,
    onProgress?: (event: ChatProgress) => void,
  ): Promise<ChatOutcome>;
  usage(): Promise<ChatUsage>;
}
