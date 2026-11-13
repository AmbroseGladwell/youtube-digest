import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Project, ProjectId, ProjectMember } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import { projectKeys } from "../projectKeys.js";

export interface DeleteProjectVariables {
  projectId: ProjectId;
}

interface DeleteProjectContext {
  previousProjects: Project[] | undefined;
  previousMembers: ProjectMember[] | undefined;
}

export function useDeleteProjectMutation() {
  const { projectStore } = useStores();
  const queryClient = useQueryClient();

  return useMutation<void, Error, DeleteProjectVariables, DeleteProjectContext>({
    mutationKey: projectKeys.all,
    mutationFn: ({ projectId }) => projectStore.deleteProject(projectId),
    onMutate: async ({ projectId }) => {
      await queryClient.cancelQueries({ queryKey: projectKeys.all });
      const previousProjects = queryClient.getQueryData<Project[]>(projectKeys.list());
      const previousMembers = queryClient.getQueryData<ProjectMember[]>(projectKeys.members());
      queryClient.setQueryData<Project[]>(projectKeys.list(), (current) => current?.filter((project) => project.id !== projectId));
      queryClient.setQueryData<ProjectMember[]>(projectKeys.members(), (current) =>
        current?.filter((member) => member.projectId !== projectId),
      );
      return { previousProjects, previousMembers };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      queryClient.setQueryData(projectKeys.list(), context.previousProjects);
      queryClient.setQueryData(projectKeys.members(), context.previousMembers);
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: projectKeys.all }) === 1) {
        void queryClient.invalidateQueries({ queryKey: projectKeys.all });
      }
    },
  });
}
