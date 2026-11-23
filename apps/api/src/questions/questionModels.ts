import { SONNET_MODEL_ID } from "@overview/domain";
import { chatModel } from "../chats/chatModel.js";

export const QUESTION_LABEL_MODEL = chatModel;

// Sonnet won the owner's blind comparison with Sol (docs/features/suggested-questions.md, "Writing").
export const QUESTION_WRITER_MODEL = { provider: "anthropic", model: SONNET_MODEL_ID } as const;
