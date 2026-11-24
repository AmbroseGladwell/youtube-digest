import { tagUsage, type Novelty, type TagCount, type TopicId } from "@overview/domain";
import { libraryEntrySavedAt, type LibraryEntry } from "../../overviews/types/LibraryEntry.js";
import { LIBRARY_ADDED, type LibraryAdded, type LibraryKind } from "../types/LibraryFilters.js";
import { libraryAddedSince } from "./libraryAddedSince.js";
import { libraryKindsOf } from "./libraryKindsOf.js";
import { librarySourceOf, type LibrarySource } from "./librarySourceOf.js";

export interface LibrarySourceCount extends LibrarySource {
  count: number;
}

export interface LibraryFilterCounts {
  total: number;
  unread: number;
  favourite: number;
  dubious: number;
  unreadable: number;
  withoutOverview: number;
  noTopic: number;
  byTopic: Record<string, number>;
  byNovelty: Record<string, number>;
  byTag: TagCount[];
  byKind: Partial<Record<LibraryKind, number>>;
  bySource: LibrarySourceCount[];
  byAdded: Record<LibraryAdded, number>;
}

// Across the whole library, not narrowed by other filters; unreadable records count: docs/features/library-filters.md, "Counts".
export const libraryFilterCounts = (entries: LibraryEntry[], now: Date = new Date()): LibraryFilterCounts => {
  const byTopic: Record<string, number> = {};
  const byNovelty: Record<string, number> = {};
  const byKind: Partial<Record<LibraryKind, number>> = {};
  const bySource = new Map<string, LibrarySourceCount>();
  const since = LIBRARY_ADDED.map((added) => [added, libraryAddedSince(added, now)] as const);
  const byAdded = Object.fromEntries(LIBRARY_ADDED.map((added) => [added, 0])) as Record<LibraryAdded, number>;
  let unread = 0;
  let favourite = 0;
  let dubious = 0;
  let unreadable = 0;
  let withoutOverview = 0;
  let noTopic = 0;

  for (const entry of entries) {
    if (!entry.state.read) {
      unread += 1;
    }
    if (entry.kind === "capture") {
      withoutOverview += 1;
      continue;
    }
    const savedAt = Date.parse(libraryEntrySavedAt(entry) ?? "");
    for (const [added, cutoff] of since) {
      if (cutoff === null || (Number.isFinite(savedAt) && savedAt >= cutoff)) {
        byAdded[added] += 1;
      }
    }
    if (entry.state.favourite) {
      favourite += 1;
    }
    if (entry.kind === "unreadable") {
      unreadable += 1;
      continue;
    }
    const { overview } = entry;
    if (overview.verdict?.dubious) {
      dubious += 1;
    }
    for (const kind of libraryKindsOf(overview)) {
      byKind[kind] = (byKind[kind] ?? 0) + 1;
    }
    const source = librarySourceOf(overview.source);
    const counted = bySource.get(source.id);
    if (counted === undefined) {
      bySource.set(source.id, { ...source, count: 1 });
    } else {
      counted.count += 1;
    }
    if (overview.topicIds.length === 0) {
      noTopic += 1;
    }
    for (const topicId of overview.topicIds as TopicId[]) {
      byTopic[topicId] = (byTopic[topicId] ?? 0) + 1;
    }
    const novelty: Novelty | undefined = overview.verdict?.novelty;
    if (novelty) {
      byNovelty[novelty] = (byNovelty[novelty] ?? 0) + 1;
    }
  }

  const byTag = tagUsage(entries.map((entry) => [...(entry.kind === "overview" ? entry.overview.tags : []), ...entry.state.userTags]));

  return {
    total: entries.length - withoutOverview,
    unread,
    favourite,
    dubious,
    unreadable,
    withoutOverview,
    noTopic,
    byTopic,
    byNovelty,
    byTag,
    byKind,
    bySource: [...bySource.values()].sort((left, right) => right.count - left.count || left.name.localeCompare(right.name)),
    byAdded,
  };
};
