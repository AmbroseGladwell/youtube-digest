import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Project, ProjectId, ProjectPatch } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import { projectKeys } from "../projectKeys.js";

export interface UpdateProjectVariables {
  projectId: ProjectId;
  patch: ProjectPatch;
}

interface UpdateProjectContext {
  previous: Project[] | undefined;
}

export const applyProjectPatch = (project: Project, patch: ProjectPatch): Project => ({
  ...project,
  ...Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)),
});

export function useUpdateProjectMutation() {
  const { projectStore } = useStores();
  const queryClient = useQueryClient();

  return useMutation<void, Error, UpdateProjectVariables, UpdateProjectContext>({
    mutationKey: projectKeys.all,
    mutationFn: ({ projectId, patch }) => projectStore.updateProject(projectId, patch),
    onMutate: async ({ projectId, patch }) => {
      await queryClient.cancelQueries({ queryKey: projectKeys.all });
      const previous = queryClient.getQueryData<Project[]>(projectKeys.list());
      queryClient.setQueryData<Project[]>(projectKeys.list(), (current) =>
        current?.map((project) => (project.id === projectId ? applyProjectPatch(project, patch) : project)),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context) queryClient.setQueryData(projectKeys.list(), context.previous);
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: projectKeys.all }) === 1) {
        void queryClient.invalidateQueries({ queryKey: projectKeys.all });
      }
    },
  });
}
