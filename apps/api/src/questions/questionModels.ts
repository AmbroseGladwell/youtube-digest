import { chatModel } from "../chats/chatModel.js";
import { ourKeyModel } from "../generation/ourKeyModel.js";

export const QUESTION_LABEL_MODEL = chatModel;

// One place to swap the writer; Sol and Sonnet are still being compared (docs/features/suggested-questions.md, "Writing").
export const QUESTION_WRITER_MODEL = ourKeyModel;
