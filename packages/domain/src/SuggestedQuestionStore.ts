import type { SuggestedQuestion, SuggestedQuestionChange, SuggestedQuestionScope } from "./SuggestedQuestion.js";

// The server writes questions; the reader only records what became of one (docs/features/suggested-questions.md).
export interface SuggestedQuestionStore {
  // Newest first, live ones only.
  listSuggestedQuestions(scope: SuggestedQuestionScope): Promise<SuggestedQuestion[]>;
  getSuggestedQuestion(id: string): Promise<SuggestedQuestion | null>;
  changeSuggestedQuestion(id: string, change: SuggestedQuestionChange): Promise<void>;
}
