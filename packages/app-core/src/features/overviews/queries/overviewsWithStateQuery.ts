import { queryOptions, useQuery } from "@tanstack/react-query";
import {
  DEFAULT_OVERVIEW_STATE,
  OverviewId,
  type OverviewState,
  type OverviewStore,
} from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import type { LibraryEntry } from "../types/LibraryEntry.js";
import { overviewKeys } from "../overviewKeys.js";

// Read and favourite survive a record that does not, because overview state is its own
// record in its own store (docs/prototype/decisions.md).
const stateFor = (overviewStore: OverviewStore, id: string): Promise<OverviewState> => {
  const parsed = OverviewId.safeParse(id);
  return parsed.success
    ? overviewStore.getOverviewState(parsed.data)
    : Promise.resolve({ ...DEFAULT_OVERVIEW_STATE, overviewId: id as OverviewId });
};

export const overviewsWithStateQueryOptions = (overviewStore: OverviewStore) =>
  queryOptions({
    queryKey: overviewKeys.list(),
    queryFn: async (): Promise<LibraryEntry[]> => {
      const [overviews, unreadable] = await Promise.all([
        overviewStore.listOverviews(),
        overviewStore.listUnreadable(),
      ]);
      const unreadableOverviews = unreadable.filter((record) => record.kind === "overview");

      const [overviewStates, unreadableStates] = await Promise.all([
        Promise.all(overviews.map((overview) => stateFor(overviewStore, overview.id))),
        Promise.all(unreadableOverviews.map((record) => stateFor(overviewStore, record.id))),
      ]);

      return [
        ...overviews.map((overview, index) => ({
          kind: "overview" as const,
          overview,
          state: overviewStates[index]!,
        })),
        ...unreadableOverviews.map((record, index) => ({
          kind: "unreadable" as const,
          record,
          state: unreadableStates[index]!,
        })),
      ];
    },
  });

export const useOverviewsWithStateQuery = () => {
  const { overviewStore } = useStores();
  return useQuery(overviewsWithStateQueryOptions(overviewStore));
};
