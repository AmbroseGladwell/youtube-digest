import { Novelty, Tag, TopicId } from "@overview/domain";
import {
  LIBRARY_ADDED,
  LIBRARY_KINDS,
  NO_LIBRARY_FILTERS,
  type LibraryFilters,
  type LibraryKind,
  type LibrarySourceId,
  type LibraryTopicFilter,
} from "../types/LibraryFilters.js";
import { DEFAULT_LIBRARY_SORT, LIBRARY_SORTS, type LibrarySort } from "../types/LibrarySort.js";
import type { LibraryView } from "../types/LibraryView.js";

const STATUS_VALUES = new Set(["all", "read", "unread"]);
const SOURCE_ID = /^(?:[a-zA-Z]+|site:[^,\s]+)$/;
const LIBRARY_VIEW_PARAMS = ["kind", "source", "added", "topic", "verdict", "status", "fav", "pending", "dubious", "tag", "q", "sort"];

const listParam = (searchParams: URLSearchParams, name: string): string[] => {
  const value = searchParams.get(name);
  return value ? [...new Set(value.split(",").filter(Boolean))] : [];
};

const isKind = (value: string): value is LibraryKind => (LIBRARY_KINDS as readonly string[]).includes(value);

const parseTopic = (value: string | null): LibraryTopicFilter => {
  if (value === "none") {
    return "none";
  }
  return value && TopicId.safeParse(value).success ? (value as TopicId) : "all";
};

// An old ?source=video names a kind, so bookmarks keep working: docs/features/library-filters.md, "In the URL".
export const parseLibraryFilters = (searchParams: URLSearchParams): LibraryFilters => {
  const statusParam = searchParams.get("status");
  const addedParam = searchParams.get("added");
  const sourceValues = listParam(searchParams, "source");
  const oldKinds = searchParams.has("kind") ? [] : sourceValues.filter(isKind);

  return {
    kinds: [...new Set([...listParam(searchParams, "kind").filter(isKind), ...oldKinds])],
    sources: sourceValues.filter((value) => !isKind(value) && SOURCE_ID.test(value)) as LibrarySourceId[],
    added: LIBRARY_ADDED.find((added) => added === addedParam) ?? NO_LIBRARY_FILTERS.added,
    topicId: parseTopic(searchParams.get("topic")),
    novelties: listParam(searchParams, "verdict").filter((value): value is Novelty => Novelty.safeParse(value).success),
    status: statusParam && STATUS_VALUES.has(statusParam) ? (statusParam as LibraryFilters["status"]) : "all",
    favourite: searchParams.get("fav") === "1",
    withoutOverview: searchParams.get("pending") === "1",
    dubious: searchParams.get("dubious") === "1",
    tags: listParam(searchParams, "tag").filter((value) => Tag.safeParse(value).success),
    query: searchParams.get("q") ?? NO_LIBRARY_FILTERS.query,
  };
};

export const applyLibraryFilterPatch = (current: URLSearchParams, patch: Partial<LibraryFilters>): URLSearchParams => {
  const next = new URLSearchParams(current);

  if ("kinds" in patch || "sources" in patch) {
    const before = parseLibraryFilters(current);
    setOrDelete(next, "kind", (patch.kinds ?? before.kinds).join(","));
    setOrDelete(next, "source", (patch.sources ?? before.sources).join(","));
  }
  if ("added" in patch) {
    setOrDelete(next, "added", patch.added === "any" ? undefined : patch.added);
  }
  if ("topicId" in patch) {
    setOrDelete(next, "topic", patch.topicId === "all" ? undefined : patch.topicId);
  }
  if ("novelties" in patch) {
    setOrDelete(next, "verdict", patch.novelties?.join(","));
  }
  if ("status" in patch) {
    setOrDelete(next, "status", patch.status === "all" ? undefined : patch.status);
  }
  if ("favourite" in patch) {
    setOrDelete(next, "fav", patch.favourite ? "1" : undefined);
  }
  if ("withoutOverview" in patch) {
    setOrDelete(next, "pending", patch.withoutOverview ? "1" : undefined);
  }
  if ("dubious" in patch) {
    setOrDelete(next, "dubious", patch.dubious ? "1" : undefined);
  }
  if ("tags" in patch) {
    setOrDelete(next, "tag", patch.tags?.join(","));
  }
  if ("query" in patch) {
    setOrDelete(next, "q", patch.query || undefined);
  }

  return next;
};

export const parseLibrarySort = (searchParams: URLSearchParams): LibrarySort => {
  const sortParam = searchParams.get("sort");
  return LIBRARY_SORTS.find((sort) => sort === sortParam) ?? DEFAULT_LIBRARY_SORT;
};

export const applyLibrarySort = (current: URLSearchParams, sort: LibrarySort): URLSearchParams => {
  const next = new URLSearchParams(current);
  setOrDelete(next, "sort", sort === DEFAULT_LIBRARY_SORT ? undefined : sort);
  return next;
};

export const hasLibraryViewParams = (searchParams: URLSearchParams): boolean => {
  return LIBRARY_VIEW_PARAMS.some((param) => searchParams.has(param));
};

export const parseLibraryView = (searchParams: URLSearchParams): LibraryView => {
  return { filters: parseLibraryFilters(searchParams), sort: parseLibrarySort(searchParams) };
};

export const applyLibraryView = (current: URLSearchParams, view: LibraryView): URLSearchParams => {
  return applyLibrarySort(applyLibraryFilterPatch(current, view.filters), view.sort);
};

export const isSameLibraryView = (left: LibraryView, right: LibraryView): boolean => {
  return applyLibraryView(new URLSearchParams(), left).toString() === applyLibraryView(new URLSearchParams(), right).toString();
};

const setOrDelete = (params: URLSearchParams, key: string, value: string | undefined): void => {
  if (value) {
    params.set(key, value);
  } else {
    params.delete(key);
  }
};
