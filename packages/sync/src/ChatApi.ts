import type { ChatQuestionRequest, ChatStreamEvent, ChatUsage } from "@overview/domain";

export type ChatOutcome = Exclude<ChatStreamEvent, { type: "text" }>;

// Asking about an overview on our server: the answer streams to `onText` as it is written,
// then settles as stored or failed. A refusal before it starts (a wait, a full conversation,
// no transcript) throws the API's own error (docs/features/chats.md, "Asking").
export interface ChatApi {
  ask(overviewId: string, question: ChatQuestionRequest, onText: (text: string) => void, signal?: AbortSignal): Promise<ChatOutcome>;
  usage(): Promise<ChatUsage>;
}
