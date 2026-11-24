import type { SavedCapture } from "@overview/domain";
import { searchHaystackOf } from "./searchHaystackOf.js";
import { libraryEntrySavedAt, type LibraryEntry } from "../../overviews/types/LibraryEntry.js";
import { libraryKindsOf } from "./libraryKindsOf.js";
import { librarySourceOf } from "./librarySourceOf.js";
import { libraryAddedSince } from "./libraryAddedSince.js";
import type { LibraryFilters } from "../types/LibraryFilters.js";

// Any of a group's values, every group at once; unreadable records: docs/features/library-filters.md.
export const matchesLibraryFilters = (entry: LibraryEntry, filters: LibraryFilters, now: Date = new Date()): boolean => {
  const { state } = entry;

  if (filters.withoutOverview && entry.kind !== "capture") {
    return false;
  }
  if (filters.status === "read" && !state.read) {
    return false;
  }
  if (filters.status === "unread" && state.read) {
    return false;
  }
  if (filters.favourite && !state.favourite) {
    return false;
  }
  if (!addedInTime(entry, filters, now)) {
    return false;
  }

  const query = filters.query.trim().toLowerCase();

  if (entry.kind === "unreadable") {
    return (
      filters.kinds.length === 0 &&
      filters.sources.length === 0 &&
      filters.topicId === "all" &&
      filters.novelties.length === 0 &&
      !filters.dubious &&
      filters.tags.length === 0 &&
      !query
    );
  }

  if (entry.kind === "capture") {
    return matchesSavedCapture(entry.capture, filters, query);
  }

  const { overview } = entry;
  if (filters.kinds.length > 0 && !libraryKindsOf(overview).some((kind) => filters.kinds.includes(kind))) {
    return false;
  }
  if (filters.sources.length > 0 && !filters.sources.includes(librarySourceOf(overview.source).id)) {
    return false;
  }
  if (filters.topicId === "none" && overview.topicIds.length > 0) {
    return false;
  }
  if (filters.topicId !== "all" && filters.topicId !== "none" && !overview.topicIds.includes(filters.topicId)) {
    return false;
  }
  if (filters.novelties.length > 0 && (overview.verdict === null || !filters.novelties.includes(overview.verdict.novelty))) {
    return false;
  }
  if (filters.dubious && !overview.verdict?.dubious) {
    return false;
  }
  if (filters.tags.length > 0 && !filters.tags.some((tag) => overview.tags.includes(tag) || state.userTags.includes(tag))) {
    return false;
  }
  if (query && !searchHaystackOf(overview).includes(query)) {
    return false;
  }

  return true;
};

// Without a readable date it matches only Any time: docs/features/record-migrations.md, "Ordering needs a date".
const addedInTime = (entry: LibraryEntry, filters: LibraryFilters, now: Date): boolean => {
  const since = libraryAddedSince(filters.added, now);
  if (since === null) {
    return true;
  }
  const savedAt = Date.parse(libraryEntrySavedAt(entry) ?? "");
  return Number.isFinite(savedAt) && savedAt >= since;
};

// No topic, verdict or tags until its overview: docs/features/kept-links.md, "In the library".
const matchesSavedCapture = (capture: SavedCapture, filters: LibraryFilters, query: string): boolean => {
  const overviewOnly = filters.status === "read" || filters.favourite || filters.dubious || filters.tags.length > 0;
  if (overviewOnly || filters.topicId !== "all" || filters.novelties.length > 0) {
    return false;
  }
  if (filters.kinds.length > 0 && !libraryKindsOf({ source: capture.source, recipe: null }).some((kind) => filters.kinds.includes(kind))) {
    return false;
  }
  if (filters.sources.length > 0 && !filters.sources.includes(librarySourceOf(capture.source).id)) {
    return false;
  }
  return !query || capture.source.title.toLowerCase().includes(query);
};
