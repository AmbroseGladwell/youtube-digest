import { queryOptions, useQuery } from "@tanstack/react-query";
import { DEFAULT_OVERVIEW_STATE, type OverviewId, type OverviewState, type OverviewStore } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import type { LibraryEntry } from "../types/LibraryEntry.js";
import { overviewKeys } from "../overviewKeys.js";

// Why state is its own record: docs/prototype/decisions.md, "The data model".
export const readLibraryEntries = async (overviewStore: OverviewStore): Promise<LibraryEntry[]> => {
  const [overviews, unreadable, states] = await Promise.all([
    overviewStore.listOverviews(),
    overviewStore.listUnreadable(),
    overviewStore.listOverviewStates(),
  ]);
  const stateById = new Map<string, OverviewState>(states.map((state) => [state.overviewId, state]));
  const stateOf = (id: string): OverviewState => stateById.get(id) ?? { ...DEFAULT_OVERVIEW_STATE, overviewId: id as OverviewId };

  return [
    ...overviews.map((overview) => ({ kind: "overview" as const, overview, state: stateOf(overview.id) })),
    ...unreadable.flatMap((record) =>
      record.kind === "overview" ? [{ kind: "unreadable" as const, record, state: stateOf(record.id) }] : [],
    ),
  ];
};

export const overviewsWithStateQueryOptions = (overviewStore: OverviewStore) =>
  queryOptions({
    queryKey: overviewKeys.list(),
    queryFn: () => readLibraryEntries(overviewStore),
  });

export const useOverviewsWithStateQuery = () => {
  const { overviewStore } = useStores();
  return useQuery(overviewsWithStateQueryOptions(overviewStore));
};
