import type {
  ChatQuestionInput,
  ChatStreamEvent,
  ChatUsage,
  ProjectId,
  SuggestedQuestionRefreshStatus,
  SuggestedQuestionScope,
} from "@overview/domain";

export type ChatOutcome = Extract<ChatStreamEvent, { type: "answered" | "failed" }>;
export type AskOwner = { kind: "library" } | { kind: "project"; id: ProjectId };
export type AskQuestionInput = Pick<ChatQuestionInput, "conversationId" | "text" | "pins" | "setAside">;

export type ChatProgress = Extract<ChatStreamEvent, { type: "sources" | "section" | "picking" | "picked" }>;

// A refusal before the answer starts throws the API's own error (docs/features/chats.md, "Asking").
export interface ChatApi {
  ask(
    overviewId: string,
    question: ChatQuestionInput,
    onText: (text: string) => void,
    signal?: AbortSignal,
    onProgress?: (event: ChatProgress) => void,
  ): Promise<ChatOutcome>;
  askOver(
    owner: AskOwner,
    question: AskQuestionInput,
    onText: (text: string) => void,
    signal?: AbortSignal,
    onProgress?: (event: ChatProgress) => void,
  ): Promise<ChatOutcome>;
  usage(): Promise<ChatUsage>;
  refreshSuggestedQuestions(scope: SuggestedQuestionScope): Promise<SuggestedQuestionRefreshStatus>;
}
