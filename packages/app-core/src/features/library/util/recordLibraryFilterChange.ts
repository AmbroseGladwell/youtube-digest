import type { Analytics } from "../../analytics/createAnalytics.js";
import type { LibraryFilters } from "../types/LibraryFilters.js";

export type FilterControl = "panel" | "searchChip" | "clearAll" | "reset" | "caughtUp";

// One event per filter the patch actually changes, named for the filter and carrying the
// value it changed to: a topic by its id, a novelty or status by its own enum, never a label
// (docs/architecture/analytics.md, "What an event may carry"). The search query is not here:
// it is counted once the reader stops typing.
export function recordLibraryFilterChange(
  analytics: Analytics["library"]["filters"],
  before: LibraryFilters,
  patch: Partial<LibraryFilters>,
  from: FilterControl,
): void {
  if (patch.topicId !== undefined && patch.topicId !== before.topicId) {
    if (patch.topicId === "all") analytics.topicCleared({ from });
    else analytics.topicChosen({ topicId: patch.topicId, from });
  }
  if (patch.novelty !== undefined && patch.novelty !== before.novelty) {
    analytics.noveltyChosen({ novelty: patch.novelty, from });
  }
  if (patch.status !== undefined && patch.status !== before.status) {
    analytics.statusChosen({ status: patch.status, from });
  }
  if (patch.favourite !== undefined && patch.favourite !== before.favourite) {
    analytics.favouriteSwitched({ on: patch.favourite, from });
  }
  if (patch.dubious !== undefined && patch.dubious !== before.dubious) {
    analytics.dubiousSwitched({ on: patch.dubious, from });
  }
  if (patch.tag !== undefined && patch.tag !== before.tag) {
    if (patch.tag === null) analytics.tagCleared({ from });
    else analytics.tagChosen({ from });
  }
}
