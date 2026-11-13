import { queryOptions, useQuery } from "@tanstack/react-query";
import type { ProjectStore } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import { projectKeys } from "../projectKeys.js";

export const projectMembersQueryOptions = (projectStore: ProjectStore) =>
  queryOptions({
    queryKey: projectKeys.members(),
    queryFn: () => projectStore.listMembers(),
  });

export const useProjectMembersQuery = () => {
  const { projectStore } = useStores();
  return useQuery(projectMembersQueryOptions(projectStore));
};
