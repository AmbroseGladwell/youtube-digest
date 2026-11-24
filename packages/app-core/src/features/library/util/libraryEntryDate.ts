import { libraryEntryId, libraryEntrySavedAt, type LibraryEntry } from "../../overviews/types/LibraryEntry.js";
import type { LibrarySortField } from "../types/LibrarySort.js";

// The reader's latest project or chat act per overview id, as epoch ms.
export type LibraryActivity = ReadonlyMap<string, number>;

export const NO_LIBRARY_ACTIVITY: LibraryActivity = new Map();

const timeOf = (value: string | null | undefined): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
};

const publishedAtOf = (entry: LibraryEntry): string | null => {
  switch (entry.kind) {
    case "overview":
      return entry.overview.source.publishedAt;
    case "capture":
      return entry.capture.source.publishedAt;
    case "unreadable":
      return null;
  }
};

// Saved, the reader's own edits, project changes and chat messages, never the app's writes: docs/features/library-sort.md, "Updated".
const updatedAtOf = (entry: LibraryEntry, activity: LibraryActivity): number | null => {
  const times = [
    timeOf(libraryEntrySavedAt(entry)),
    entry.kind === "overview" ? timeOf(entry.overview.editedAt) : null,
    activity.get(libraryEntryId(entry)) ?? null,
  ].filter((time): time is number => time !== null);
  return times.length === 0 ? null : Math.max(...times);
};

export const libraryEntryDate = (
  entry: LibraryEntry,
  field: Exclude<LibrarySortField, "title">,
  activity: LibraryActivity,
): number | null => {
  switch (field) {
    case "added":
      return timeOf(libraryEntrySavedAt(entry));
    case "published":
      return timeOf(publishedAtOf(entry));
    case "updated":
      return updatedAtOf(entry, activity);
  }
};

export interface ActivityMember {
  overviewId: string;
  addedAt: string;
  addedBy: { by: string };
}

export interface ActivityChat {
  overviewId?: string | undefined;
  messages: readonly { at: string }[];
}

// Filing as an overview is made isn't the reader's act; only a chat about the overview itself counts.
export const libraryActivityOf = (members: readonly ActivityMember[], chats: readonly ActivityChat[]): LibraryActivity => {
  const activity = new Map<string, number>();
  const note = (overviewId: string, at: string | undefined) => {
    const time = timeOf(at);
    if (time !== null && time > (activity.get(overviewId) ?? Number.NEGATIVE_INFINITY)) {
      activity.set(overviewId, time);
    }
  };
  for (const member of members) {
    if (member.addedBy.by !== "filing") {
      note(member.overviewId, member.addedAt);
    }
  }
  for (const chat of chats) {
    if (chat.overviewId !== undefined) {
      note(chat.overviewId, chat.messages.at(-1)?.at);
    }
  }
  return activity;
};
