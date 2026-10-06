import { NOVELTY_LABEL, type Topic } from "@overview/domain";
import type { LibraryFilters } from "../types/LibraryFilters.js";
import { DEFAULT_LIBRARY_VIEW } from "../types/LibraryView.js";

export interface LibraryFilterChip {
  key: string;
  label: string;
  removeLabel: string;
  clear: Partial<LibraryFilters>;
}

const DEFAULTS = DEFAULT_LIBRARY_VIEW.filters;

// One chip per filter changed from the view the library opens on, in the order the row
// shows them: tag, topic, verdict, show ("OV-84 2 Library Filter" 84r-2). The search is not
// one: its own field shows it. Each chip's × puts its filter back to the default.
export function libraryFilterChips(filters: LibraryFilters, topics: Topic[]): LibraryFilterChip[] {
  const chips: LibraryFilterChip[] = [];

  if (filters.tag !== DEFAULTS.tag && filters.tag !== null) {
    chips.push({
      key: "tag",
      label: `#${filters.tag}`,
      removeLabel: `Remove tag filter ${filters.tag}`,
      clear: { tag: DEFAULTS.tag },
    });
  }
  if (filters.topicId !== DEFAULTS.topicId) {
    const name = topics.find((topic) => topic.id === filters.topicId)?.name ?? "Topic";
    chips.push({ key: "topic", label: name, removeLabel: `Remove topic filter ${name}`, clear: { topicId: DEFAULTS.topicId } });
  }
  if (filters.novelty !== DEFAULTS.novelty && filters.novelty !== "all") {
    const label = NOVELTY_LABEL[filters.novelty];
    chips.push({ key: "verdict", label, removeLabel: `Remove verdict filter ${label}`, clear: { novelty: DEFAULTS.novelty } });
  }
  if (filters.dubious !== DEFAULTS.dubious) {
    chips.push({ key: "dubious", label: "Dubious only", removeLabel: "Remove filter Dubious only", clear: { dubious: DEFAULTS.dubious } });
  }
  if (filters.favourite !== DEFAULTS.favourite) {
    chips.push({ key: "favourite", label: "Favourites", removeLabel: "Remove filter Favourites", clear: { favourite: DEFAULTS.favourite } });
  }
  if (filters.status !== DEFAULTS.status) {
    const label = { all: "Read and unread", read: "Read", unread: "Unread only" }[filters.status];
    chips.push({ key: "status", label, removeLabel: `Remove filter ${label}`, clear: { status: DEFAULTS.status } });
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
