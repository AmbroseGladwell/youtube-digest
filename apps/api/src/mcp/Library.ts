import type { Overview, OverviewState, Topic } from "@overview/domain";

export interface LibraryEntry {
  overview: Overview;
  state: OverviewState | null;
}

export interface Library {
  entries: LibraryEntry[];
  topics: Topic[];
  unreadable: number;
}
