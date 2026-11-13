import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BY_READER, ProjectId, type OverviewId, type Project } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import { projectKeys } from "../projectKeys.js";

export interface CreateProjectVariables {
  name: string;
  purpose: string | null;
  overviewIds: OverviewId[];
}

// Not optimistic: the page it opens onto needs the project to be there.
export function useCreateProjectMutation() {
  const { projectStore } = useStores();
  const queryClient = useQueryClient();

  return useMutation<Project, Error, CreateProjectVariables>({
    mutationKey: projectKeys.all,
    mutationFn: async ({ name, purpose, overviewIds }) => {
      const project: Project = {
        id: ProjectId.parse(crypto.randomUUID()),
        name: name.trim(),
        purpose,
        createdAt: new Date().toISOString(),
        createdBy: BY_READER,
        purposeBy: purpose === null ? null : BY_READER,
        archivedAt: null,
      };
      await projectStore.createProject(project);
      for (const overviewId of overviewIds) await projectStore.addToProject(project.id, overviewId);
      return project;
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: projectKeys.all }) === 1) {
        void queryClient.invalidateQueries({ queryKey: projectKeys.all });
      }
    },
  });
}
