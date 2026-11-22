import type { MeaningSearchResponse, Project } from "@overview/domain";
import type { OverviewWithState } from "../../overviews/types/OverviewWithState.js";

export const PROJECT_SUGGESTIONS = 5;

export const projectSuggestionQuery = ({ name, purpose }: Pick<Project, "name" | "purpose">): string =>
  purpose === null ? name : `${name}. ${purpose}`;

export interface ProjectSuggestionsInput {
  result: MeaningSearchResponse | undefined;
  overviews: OverviewWithState[];
  inProject: ReadonlySet<string>;
  takenOut: ReadonlySet<string>;
}

// No closeness cut-off beyond the server's floor: OV-229 found none that holds.
export const projectSuggestions = ({ result, overviews, inProject, takenOut }: ProjectSuggestionsInput): OverviewWithState[] => {
  if (result === undefined || !result.available) {
    return [];
  }
  const byId = new Map(overviews.map((entry) => [entry.overview.id as string, entry]));
  return result.matches
    .filter(({ overviewId }) => !inProject.has(overviewId) && !takenOut.has(overviewId))
    .flatMap(({ overviewId }) => byId.get(overviewId) ?? [])
    .slice(0, PROJECT_SUGGESTIONS);
};
