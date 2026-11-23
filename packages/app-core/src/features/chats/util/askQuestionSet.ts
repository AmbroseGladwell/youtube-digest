import type { OverviewId, SuggestedQuestion } from "@overview/domain";
import type { AskQuestion, AskQuestionOverview, CustomAskQuestion, TemplateAskQuestion } from "../types/AskQuestion.js";

export const ASK_QUESTIONS_SHOWN = 3;

export interface AskQuestionPage {
  questions: AskQuestion[];
  page: number;
  pages: number;
  canCycle: boolean;
}

export interface CustomQuestionFacts {
  overviewOf: (id: OverviewId) => AskQuestionOverview | null;
  removed: ReadonlySet<string>;
  goodOf: (question: SuggestedQuestion) => boolean;
}

const templateOf = (text: string): TemplateAskQuestion => ({ kind: "template", id: `template:${text}`, text });

// A question whose overview isn't on the device yet waits until it is.
export const customAskQuestions = (
  questions: readonly SuggestedQuestion[],
  { overviewOf, removed, goodOf }: CustomQuestionFacts,
): CustomAskQuestion[] =>
  questions.flatMap((question) => {
    const [first, second] = question.overviewIds.map(overviewOf);
    if (removed.has(question.id) || first === null || first === undefined || second === null || second === undefined) {
      return [];
    }
    return [{ kind: "custom", id: question.id, text: question.text, overviews: [first, second], good: goodOf(question) }];
  });

export const askQuestionSet = (custom: readonly CustomAskQuestion[], templates: readonly string[]): AskQuestion[] => [
  ...custom,
  ...templates.map(templateOf),
];

export const askQuestionPage = (set: readonly AskQuestion[], page: number): AskQuestionPage => {
  const pages = Math.max(1, Math.ceil(set.length / ASK_QUESTIONS_SHOWN));
  const shown = Math.min(Math.max(page, 0), pages - 1);
  return {
    questions: set.slice(shown * ASK_QUESTIONS_SHOWN, (shown + 1) * ASK_QUESTIONS_SHOWN),
    page: shown,
    pages,
    canCycle: set.length > ASK_QUESTIONS_SHOWN,
  };
};

export const nextAskQuestionPage = ({ page, pages }: Pick<AskQuestionPage, "page" | "pages">): number => (page + 1) % pages;
