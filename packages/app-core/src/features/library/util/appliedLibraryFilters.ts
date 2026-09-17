import type { Topic } from "@overview/types";
import { NOVELTY_LABEL } from "../../overviews/noveltyLabel.js";
import type { LibraryFilters } from "../types/LibraryFilters.js";

export interface AppliedLibraryFilter {
  key: string;
  label: string;
  clear: Partial<LibraryFilters>;
}

export function appliedLibraryFilters(
  filters: LibraryFilters,
  topics: Topic[],
): AppliedLibraryFilter[] {
  const applied: AppliedLibraryFilter[] = [];

  if (filters.topicId !== "all") {
    const topic = topics.find((candidate) => candidate.id === filters.topicId);
    applied.push({
      key: "topic",
      label: topic?.name ?? "Topic",
      clear: { topicId: "all" },
    });
  }
  if (filters.novelty !== "all") {
    applied.push({
      key: "verdict",
      label: NOVELTY_LABEL[filters.novelty],
      clear: { novelty: "all" },
    });
  }
  if (filters.status !== "all") {
    applied.push({
      key: "status",
      label: filters.status === "unread" ? "Unread" : "Read",
      clear: { status: "all" },
    });
  }
  if (filters.favourite) {
    applied.push({ key: "favourite", label: "Favourites", clear: { favourite: false } });
  }
  if (filters.dubious) {
    applied.push({ key: "dubious", label: "⚠ Dubious", clear: { dubious: false } });
  }
  if (filters.query.trim() !== "") {
    applied.push({ key: "query", label: `“${filters.query.trim()}”`, clear: { query: "" } });
  }

  return applied;
}
