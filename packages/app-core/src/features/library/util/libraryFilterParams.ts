import { Novelty, TopicId } from "@overview/domain";
import { NO_LIBRARY_FILTERS, type LibraryFilters } from "../types/LibraryFilters.js";
import { DEFAULT_LIBRARY_SORT, LIBRARY_SORTS, type LibrarySort } from "../types/LibrarySort.js";
import type { LibraryView } from "../types/LibraryView.js";

const STATUS_VALUES = new Set(["all", "read", "unread"]);
const LIBRARY_VIEW_PARAMS = ["topic", "verdict", "status", "fav", "dubious", "q", "sort"];

export function parseLibraryFilters(searchParams: URLSearchParams): LibraryFilters {
  const topicParam = searchParams.get("topic");
  const noveltyParam = searchParams.get("verdict");
  const statusParam = searchParams.get("status");

  const topicId = topicParam && TopicId.safeParse(topicParam).success ? (topicParam as TopicId) : "all";
  const novelty = noveltyParam && Novelty.safeParse(noveltyParam).success ? (noveltyParam as Novelty) : "all";
  const status =
    statusParam && STATUS_VALUES.has(statusParam) ? (statusParam as LibraryFilters["status"]) : "all";

  return {
    topicId,
    novelty,
    status,
    favourite: searchParams.get("fav") === "1",
    dubious: searchParams.get("dubious") === "1",
    query: searchParams.get("q") ?? NO_LIBRARY_FILTERS.query,
  };
}

export function applyLibraryFilterPatch(
  current: URLSearchParams,
  patch: Partial<LibraryFilters>,
): URLSearchParams {
  const next = new URLSearchParams(current);

  if ("topicId" in patch) setOrDelete(next, "topic", patch.topicId === "all" ? undefined : patch.topicId);
  if ("novelty" in patch) setOrDelete(next, "verdict", patch.novelty === "all" ? undefined : patch.novelty);
  if ("status" in patch) setOrDelete(next, "status", patch.status === "all" ? undefined : patch.status);
  if ("favourite" in patch) setOrDelete(next, "fav", patch.favourite ? "1" : undefined);
  if ("dubious" in patch) setOrDelete(next, "dubious", patch.dubious ? "1" : undefined);
  if ("query" in patch) setOrDelete(next, "q", patch.query || undefined);

  return next;
}

export function parseLibrarySort(searchParams: URLSearchParams): LibrarySort {
  const sortParam = searchParams.get("sort");
  return LIBRARY_SORTS.find((sort) => sort === sortParam) ?? DEFAULT_LIBRARY_SORT;
}

export function applyLibrarySort(current: URLSearchParams, sort: LibrarySort): URLSearchParams {
  const next = new URLSearchParams(current);
  setOrDelete(next, "sort", sort === DEFAULT_LIBRARY_SORT ? undefined : sort);
  return next;
}

export function hasLibraryViewParams(searchParams: URLSearchParams): boolean {
  return LIBRARY_VIEW_PARAMS.some((param) => searchParams.has(param));
}

export function parseLibraryView(searchParams: URLSearchParams): LibraryView {
  return { filters: parseLibraryFilters(searchParams), sort: parseLibrarySort(searchParams) };
}

export function applyLibraryView(current: URLSearchParams, view: LibraryView): URLSearchParams {
  return applyLibrarySort(applyLibraryFilterPatch(current, view.filters), view.sort);
}

export function isSameLibraryView(left: LibraryView, right: LibraryView): boolean {
  return applyLibraryView(new URLSearchParams(), left).toString() === applyLibraryView(new URLSearchParams(), right).toString();
}

function setOrDelete(params: URLSearchParams, key: string, value: string | undefined): void {
  if (value) {
    params.set(key, value);
  } else {
    params.delete(key);
  }
}
