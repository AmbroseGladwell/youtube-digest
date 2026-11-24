import type { Overview, SuggestedQuestion, SuggestedQuestionScope } from "@overview/domain";
import type { BackendSimulator } from "../network/BackendSimulator.testHelper.js";
import { makeOverview, makePodcastOverview, makeRecipeOverview } from "../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { makeSuggestedQuestion } from "../../src/features/chats/types/SuggestedQuestionFactory.testHelper.js";

export const SUGGESTED_TEXTS = [
  "The plants video says eat thirty a week, but the gut episode says go slowly: which fits a busy fortnight?",
  "Could the episode’s advice on adding fibre slowly change how you’d make the stew on a weeknight?",
  "Does the curry’s one-pot method make the plants video’s thirty a week easier to reach?",
  "Would the stew’s batch cooking help keep the gut episode’s slow start going past the first week?",
];

const titled = <Made extends Overview>(made: Made, title: string, savedAt: string): Made => ({
  ...made,
  savedAt,
  source: { ...made.source, title },
});

export interface SeededSuggestions {
  overviews: Overview[];
  questions: SuggestedQuestion[];
  titlesOf: (question: SuggestedQuestion) => [string, string];
}

export const seedSuggestedQuestions = (
  backendSimulator: BackendSimulator,
  scope: SuggestedQuestionScope = { kind: "library" },
): SeededSuggestions => {
  const plants = titled(makeOverview(), "Eat more plants", "2026-11-03T09:00:00.000Z");
  const gut = titled(makePodcastOverview(), "Fibre, sleep and the gut", "2026-11-04T09:00:00.000Z");
  const stew = titled(makeRecipeOverview(), "Bean & halloumi stew", "2026-11-05T09:00:00.000Z");
  const curry = titled(makeOverview(), "One-pot prawn & lentil curry", "2026-11-06T09:00:00.000Z");
  const overviews = [plants, gut, stew, curry];
  const pairs: Array<[Overview, Overview]> = [
    [plants, gut],
    [gut, stew],
    [curry, plants],
    [stew, gut],
  ];
  const questions = pairs.map(([first, second], index) =>
    makeSuggestedQuestion({
      scope,
      overviewIds: [first.id, second.id],
      text: SUGGESTED_TEXTS[index]!,
      madeAt: `2026-11-2${4 - index}T09:00:00.000Z`,
    }),
  );
  for (const overview of overviews) {
    backendSimulator.overviews.seedSynced(overview);
  }
  for (const question of questions) {
    backendSimulator.suggestedQuestions.seed(question);
  }
  backendSimulator.chats.setUsage({ plan: "plus" });
  const titleOf = (id: string) => overviews.find((overview) => overview.id === id)!.source.title;
  return {
    overviews,
    questions,
    titlesOf: (question) => [titleOf(question.overviewIds[0]), titleOf(question.overviewIds[1])],
  };
};
