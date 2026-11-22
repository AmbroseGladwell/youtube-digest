import { ChatProviderError } from "./streamChatCompletion.js";

export const CHAT_FAILED = "Something went wrong answering that. Try again in a while.";

export class EmptyAnswerError extends Error {}

export class AnswerCutOffError extends Error {}

export const assertWhole = (stream: { finishReason: () => string | null }): void => {
  if (stream.finishReason() === "length") {
    throw new AnswerCutOffError("the reply ran into its token cap");
  }
};

export const reasonOf = (error: unknown): string => (error instanceof Error ? error.constructor.name : "unknown");
export const statusOf = (error: unknown): number | null => (error instanceof ChatProviderError ? error.status : null);
