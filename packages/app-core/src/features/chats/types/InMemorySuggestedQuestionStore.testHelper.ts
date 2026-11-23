import {
  isSuggestedQuestionLive,
  mergeSuggestedQuestion,
  SuggestedQuestion,
  type SuggestedQuestionChange,
  type SuggestedQuestionScope,
  type SuggestedQuestionStore,
} from "@overview/domain";

export class InMemorySuggestedQuestionStore implements SuggestedQuestionStore {
  #questions = new Map<string, SuggestedQuestion>();
  readonly changes: Array<{ id: string; change: SuggestedQuestionChange }> = [];

  seedSuggestedQuestion(question: SuggestedQuestion) {
    this.#questions.set(question.id, question);
  }

  async listSuggestedQuestions(scope: SuggestedQuestionScope) {
    return [...this.#questions.values()]
      .filter((question) =>
        scope.kind === "library"
          ? question.scope.kind === "library"
          : question.scope.kind === "project" && question.scope.projectId === scope.projectId,
      )
      .filter(isSuggestedQuestionLive)
      .sort((left, right) => right.madeAt.localeCompare(left.madeAt));
  }

  async getSuggestedQuestion(id: string) {
    return this.#questions.get(id) ?? null;
  }

  async changeSuggestedQuestion(id: string, change: SuggestedQuestionChange) {
    const question = this.#questions.get(id);
    if (question === undefined) {
      return;
    }
    this.changes.push({ id, change });
    this.#questions.set(id, SuggestedQuestion.parse(mergeSuggestedQuestion(question, change)));
  }
}
