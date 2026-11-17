import { queryOptions, useQuery } from "@tanstack/react-query";
import type { ProjectStore } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import { projectKeys } from "../projectKeys.js";

export const projectTakenOutQueryOptions = (projectStore: ProjectStore) =>
  queryOptions({
    queryKey: projectKeys.takenOut(),
    queryFn: () => projectStore.listTakenOut(),
  });

export const useProjectTakenOutQuery = () => {
  const { projectStore } = useStores();
  return useQuery(projectTakenOutQueryOptions(projectStore));
};
