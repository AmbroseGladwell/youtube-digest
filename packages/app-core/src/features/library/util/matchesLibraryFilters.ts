import type { SavedCapture } from "@overview/domain";
import { searchHaystackOf } from "./searchHaystackOf.js";
import type { LibraryEntry } from "../../overviews/types/LibraryEntry.js";
import { librarySourceOf } from "./librarySourceOf.js";
import type { LibraryFilters } from "../types/LibraryFilters.js";

// Unreadable records: docs/features/record-migrations.md, "What the library does with one".
export const matchesLibraryFilters = (entry: LibraryEntry, filters: LibraryFilters): boolean => {
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

  const query = filters.query.trim().toLowerCase();

  if (entry.kind === "unreadable") {
    return (
      filters.source === "all" &&
      filters.topicId === "all" &&
      filters.novelty === "all" &&
      !filters.dubious &&
      filters.tag === null &&
      !query
    );
  }

  if (entry.kind === "capture") {
    return matchesSavedCapture(entry.capture, filters, query);
  }

  const { overview } = entry;
  if (filters.source !== "all" && librarySourceOf(overview) !== filters.source) {
    return false;
  }
  if (filters.topicId !== "all" && !overview.topicIds.includes(filters.topicId)) {
    return false;
  }
  if (filters.novelty !== "all" && overview.verdict?.novelty !== filters.novelty) {
    return false;
  }
  if (filters.dubious && !overview.verdict?.dubious) {
    return false;
  }
  if (filters.tag !== null && !overview.tags.includes(filters.tag) && !state.userTags.includes(filters.tag)) {
    return false;
  }
  if (query && !searchHaystackOf(overview).includes(query)) {
    return false;
  }

  return true;
};

// No topic, verdict or tags until its overview: docs/features/kept-links.md, "In the library".
const matchesSavedCapture = (capture: SavedCapture, filters: LibraryFilters, query: string): boolean => {
  const overviewOnly = filters.status === "read" || filters.favourite || filters.dubious || filters.tag !== null;
  if (overviewOnly || filters.topicId !== "all" || filters.novelty !== "all") {
    return false;
  }
  if (filters.source !== "all" && librarySourceOf({ source: capture.source, recipe: null }) !== filters.source) {
    return false;
  }
  return !query || capture.source.title.toLowerCase().includes(query);
};
