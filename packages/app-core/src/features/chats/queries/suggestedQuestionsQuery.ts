import { queryOptions, useQuery } from "@tanstack/react-query";
import type { ProjectId, SuggestedQuestionScope, SuggestedQuestionStore } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import { chatKeys } from "../chatKeys.js";

export const suggestedQuestionScopeOf = (projectId: ProjectId | null): SuggestedQuestionScope =>
  projectId === null ? { kind: "library" } : { kind: "project", projectId };

export const suggestedQuestionsQueryOptions = (store: SuggestedQuestionStore, projectId: ProjectId | null) =>
  queryOptions({
    queryKey: chatKeys.suggested(projectId),
    queryFn: () => store.listSuggestedQuestions(suggestedQuestionScopeOf(projectId)),
  });

export const useSuggestedQuestionsQuery = (projectId: ProjectId | null) => {
  const { suggestedQuestionStore } = useStores();
  return useQuery(suggestedQuestionsQueryOptions(suggestedQuestionStore, projectId));
};
