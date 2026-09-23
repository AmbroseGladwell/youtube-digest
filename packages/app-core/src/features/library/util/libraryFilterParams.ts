import { Novelty, TopicId } from "@overview/domain";
import { DEFAULT_LIBRARY_FILTERS, type LibraryFilters } from "../types/LibraryFilters.js";

const STATUS_VALUES = new Set(["all", "read", "unread"]);

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
    query: searchParams.get("q") ?? DEFAULT_LIBRARY_FILTERS.query,
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

function setOrDelete(params: URLSearchParams, key: string, value: string | undefined): void {
  if (value) {
    params.set(key, value);
  } else {
    params.delete(key);
  }
}
