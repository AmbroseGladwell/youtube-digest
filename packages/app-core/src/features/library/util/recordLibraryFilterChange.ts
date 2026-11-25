import type { Analytics } from "../../analytics/createAnalytics.js";
import type { LibraryFilters, LibrarySourceId } from "../types/LibraryFilters.js";
import { LIBRARY_SOURCE_PLATFORMS, type LibrarySource } from "./librarySourceOf.js";

export type FilterControl = "panel" | "filterChip" | "clearAll" | "reset" | "caughtUp";

interface Switched<T> {
  value: T;
  on: boolean;
}

const switched = <T>(before: readonly T[], after: readonly T[] | undefined): Switched<T>[] => {
  if (after === undefined) {
    return [];
  }
  return [
    ...after.filter((value) => !before.includes(value)).map((value) => ({ value, on: true })),
    ...before.filter((value) => !after.includes(value)).map((value) => ({ value, on: false })),
  ];
};

// Ids and enums, never labels or domains: docs/architecture/analytics.md, "What an event may carry".
export const recordLibraryFilterChange = (
  analytics: Analytics["library"]["filters"],
  before: LibraryFilters,
  patch: Partial<LibraryFilters>,
  from: FilterControl,
  sources: readonly LibrarySource[] = [],
): void => {
  for (const { value, on } of switched(before.kinds, patch.kinds)) {
    analytics.kindSwitched({ kind: value, on, from });
  }
  for (const { value, on } of switched(before.sources, patch.sources)) {
    analytics.sourceSwitched({ source: platformOf(value, sources), on, from });
  }
  if (patch.added !== undefined && patch.added !== before.added) {
    analytics.addedChosen({ added: patch.added, from });
  }
  if (patch.topicId !== undefined && patch.topicId !== before.topicId) {
    if (patch.topicId === "all") {
      analytics.topicCleared({ from });
    } else if (patch.topicId === "none") {
      analytics.noTopicChosen({ from });
    } else {
      analytics.topicChosen({ topicId: patch.topicId, from });
    }
  }
  for (const { value, on } of switched(before.novelties, patch.novelties)) {
    analytics.noveltySwitched({ novelty: value, on, from });
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
  for (const { on } of switched(before.tags, patch.tags)) {
    if (on) {
      analytics.tagChosen({ from });
    } else {
      analytics.tagCleared({ from });
    }
  }
};

const platformOf = (id: LibrarySourceId, sources: readonly LibrarySource[]): LibrarySource["platform"] => {
  const known = sources.find((source) => source.id === id)?.platform;
  return known ?? LIBRARY_SOURCE_PLATFORMS.find((platform) => platform === id) ?? "website";
};
