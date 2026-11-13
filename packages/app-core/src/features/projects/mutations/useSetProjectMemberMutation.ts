import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BY_READER, projectMemberId, type OverviewId, type ProjectId, type ProjectMember } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import { projectKeys } from "../projectKeys.js";

export interface SetProjectMemberVariables {
  projectId: ProjectId;
  overviewId: OverviewId;
  inProject: boolean;
}

interface SetProjectMemberContext {
  previous: ProjectMember[] | undefined;
}

export const applyProjectMemberChange = (
  members: ProjectMember[],
  { projectId, overviewId, inProject }: SetProjectMemberVariables,
  now: string,
): ProjectMember[] => {
  const id = projectMemberId(projectId, overviewId);
  const others = members.filter((member) => member.id !== id);
  if (!inProject) return others;
  const held = members.find((member) => member.id === id);
  return [...others, held ?? { id, projectId, overviewId, addedAt: now, addedBy: BY_READER, removedAt: null }];
};

export function useSetProjectMemberMutation() {
  const { projectStore } = useStores();
  const queryClient = useQueryClient();

  return useMutation<void, Error, SetProjectMemberVariables, SetProjectMemberContext>({
    mutationKey: projectKeys.all,
    mutationFn: ({ projectId, overviewId, inProject }) =>
      inProject ? projectStore.addToProject(projectId, overviewId) : projectStore.removeFromProject(projectId, overviewId),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: projectKeys.all });
      const previous = queryClient.getQueryData<ProjectMember[]>(projectKeys.members());
      queryClient.setQueryData<ProjectMember[]>(projectKeys.members(), (current) =>
        current === undefined ? current : applyProjectMemberChange(current, variables, new Date().toISOString()),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context) queryClient.setQueryData(projectKeys.members(), context.previous);
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: projectKeys.all }) === 1) {
        void queryClient.invalidateQueries({ queryKey: projectKeys.all });
      }
    },
  });
}
