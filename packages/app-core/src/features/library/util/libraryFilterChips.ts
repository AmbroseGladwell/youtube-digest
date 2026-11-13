import { NOVELTY_LABEL, type Topic } from "@overview/domain";
import { LIBRARY_SOURCE_LABEL, type LibraryFilters } from "../types/LibraryFilters.js";
import { DEFAULT_LIBRARY_VIEW } from "../types/LibraryView.js";

export interface LibraryFilterChip {
  key: string;
  label: string;
  removeLabel: string;
  clear: Partial<LibraryFilters>;
}

// One chip per filter changed from the view the library opens on, in the order the row
// shows them: tag, topic, verdict, show ("OV-84 2 Library Filter" 84r-2). The search is not
// one: its own field shows it. Each chip's × puts its filter back to the default, which on a
// project's page is every overview in it (docs/features/projects.md).
export function libraryFilterChips(
  filters: LibraryFilters,
  topics: Topic[],
  defaults: LibraryFilters = DEFAULT_LIBRARY_VIEW.filters,
): LibraryFilterChip[] {
  const chips: LibraryFilterChip[] = [];

  if (filters.tag !== defaults.tag && filters.tag !== null) {
    chips.push({
      key: "tag",
      label: `#${filters.tag}`,
      removeLabel: `Remove tag filter ${filters.tag}`,
      clear: { tag: defaults.tag },
    });
  }
  if (filters.source !== "all") {
    const label = LIBRARY_SOURCE_LABEL[filters.source];
    chips.push({ key: "source", label, removeLabel: `Remove source filter ${label}`, clear: { source: "all" } });
  }
  if (filters.topicId !== defaults.topicId) {
    const name = topics.find((topic) => topic.id === filters.topicId)?.name ?? "Topic";
    chips.push({ key: "topic", label: name, removeLabel: `Remove topic filter ${name}`, clear: { topicId: defaults.topicId } });
  }
  if (filters.novelty !== defaults.novelty && filters.novelty !== "all") {
    const label = NOVELTY_LABEL[filters.novelty];
    chips.push({ key: "verdict", label, removeLabel: `Remove verdict filter ${label}`, clear: { novelty: defaults.novelty } });
  }
  if (filters.dubious !== defaults.dubious) {
    chips.push({ key: "dubious", label: "Dubious only", removeLabel: "Remove filter Dubious only", clear: { dubious: defaults.dubious } });
  }
  if (filters.favourite !== defaults.favourite) {
    chips.push({
      key: "favourite",
      label: "Favourites",
      removeLabel: "Remove filter Favourites",
      clear: { favourite: defaults.favourite },
    });
  }
  if (filters.status !== defaults.status) {
    const label = { all: "Read and unread", read: "Read", unread: "Unread only" }[filters.status];
    chips.push({ key: "status", label, removeLabel: `Remove filter ${label}`, clear: { status: defaults.status } });
  }

  return chips;
}

// As many whole chips as fit on one line, then a "+N" for the rest (84r-2). Widths are
// measured by the caller; nothing is ever cut short.
export function fittingChipCount(chipWidths: readonly number[], available: number, moreWidth: number, gap: number): number {
  let used = 0;
  for (let index = 0; index < chipWidths.length; index += 1) {
    const rest = chipWidths.length - index - 1;
    const need = (index === 0 ? 0 : gap) + chipWidths[index]! + (rest > 0 ? gap + moreWidth : 0);
    if (used + need > available) return index;
    used += (index === 0 ? 0 : gap) + chipWidths[index]!;
  }
  return chipWidths.length;
}
