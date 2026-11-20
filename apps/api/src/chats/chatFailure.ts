import { ChatProviderError } from "./streamChatCompletion.js";

export const CHAT_FAILED = "Something went wrong answering that. Try again in a while.";

export class EmptyAnswerError extends Error {}

// The reply ran into its token cap before it was whole (OV-353 found OV-307's empty "@ project"
// replies were this: the reasoning used the whole cap).
export class AnswerCutOffError extends Error {}

export function assertWhole(stream: { finishReason: () => string | null }): void {
  if (stream.finishReason() === "length") throw new AnswerCutOffError("the reply ran into its token cap");
}

// What a failed answer's log line names: the error's class, and the provider's status when it gave one.
export const reasonOf = (error: unknown): string => (error instanceof Error ? error.constructor.name : "unknown");
export const statusOf = (error: unknown): number | null => (error instanceof ChatProviderError ? error.status : null);
