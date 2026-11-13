import { queryOptions, useQuery } from "@tanstack/react-query";
import type { ProjectStore } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import { projectKeys } from "../projectKeys.js";

export const projectsQueryOptions = (projectStore: ProjectStore) =>
  queryOptions({
    queryKey: projectKeys.list(),
    queryFn: () => projectStore.listProjects(),
  });

export const useProjectsQuery = () => {
  const { projectStore } = useStores();
  return useQuery(projectsQueryOptions(projectStore));
};
