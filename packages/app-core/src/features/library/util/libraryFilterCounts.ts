import type { Novelty, TopicId } from "@overview/domain";
import type { LibraryEntry } from "../../overviews/types/LibraryEntry.js";

export interface LibraryFilterCounts {
  total: number;
  unread: number;
  favourite: number;
  dubious: number;
  unreadable: number;
  byTopic: Record<string, number>;
  byNovelty: Record<string, number>;
}

// total counts every record the library holds, readable or not: a library that says 28
// and means 30 is the prototype's eleven missing notes with a new address
// (docs/features/record-migrations.md). The counts that read a field of the overview
// cannot include one, which is why byTopic stops summing to total.
export function libraryFilterCounts(entries: LibraryEntry[]): LibraryFilterCounts {
  const byTopic: Record<string, number> = {};
  const byNovelty: Record<string, number> = {};
  let unread = 0;
  let favourite = 0;
  let dubious = 0;
  let unreadable = 0;

  for (const entry of entries) {
    if (!entry.state.read) unread += 1;
    if (entry.state.favourite) favourite += 1;
    if (entry.kind === "unreadable") {
      unreadable += 1;
      continue;
    }
    const { overview } = entry;
    if (overview.verdict?.dubious) dubious += 1;
    for (const topicId of overview.topicIds as TopicId[]) {
      byTopic[topicId] = (byTopic[topicId] ?? 0) + 1;
    }
    const novelty: Novelty | undefined = overview.verdict?.novelty;
    if (novelty) byNovelty[novelty] = (byNovelty[novelty] ?? 0) + 1;
  }

  return { total: entries.length, unread, favourite, dubious, unreadable, byTopic, byNovelty };
}
