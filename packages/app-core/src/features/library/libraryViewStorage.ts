import { z } from "zod";
import { Novelty, TopicId } from "@overview/domain";
import { NO_LIBRARY_FILTERS } from "./types/LibraryFilters.js";
import { DEFAULT_LIBRARY_SORT, LIBRARY_SORTS } from "./types/LibrarySort.js";
import type { LibraryView, SavedLibraryViewField } from "./types/LibraryView.js";

const VERSION = 1;
const NO_ACCOUNT = "noAccount";

const SavedLibraryView = z.looseObject({ version: z.literal(VERSION) });

const FIELDS = {
  topic: z.union([TopicId, z.literal("all")]),
  novelty: z.union([Novelty, z.literal("all")]),
  status: z.enum(["all", "read", "unread"]),
  favourite: z.boolean(),
  dubious: z.boolean(),
  sort: z.enum(LIBRARY_SORTS),
} satisfies Record<SavedLibraryViewField, z.ZodType>;

export interface RestoredLibraryView {
  view: LibraryView;
  dropped: SavedLibraryViewField[];
}

const storageKey = (accountId: string | null) => `overview.libraryView.${accountId ?? NO_ACCOUNT}`;

// The list's filters and order as this account last left them on this device. Never synced:
// each origin keeps its own (docs/features/library-view.md). The search is not kept.
export function readLibraryView(
  accountId: string | null,
  storage: Storage = globalThis.localStorage,
): RestoredLibraryView | null {
  let saved: Record<string, unknown>;
  try {
    const raw = storage.getItem(storageKey(accountId));
    if (!raw) return null;
    const parsed = SavedLibraryView.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    saved = parsed.data;
  } catch {
    return null;
  }

  const dropped: SavedLibraryViewField[] = [];
  const field = <K extends SavedLibraryViewField>(name: K, fallback: z.infer<(typeof FIELDS)[K]>) => {
    const parsed = FIELDS[name].safeParse(saved[name]);
    if (parsed.success) return parsed.data as z.infer<(typeof FIELDS)[K]>;
    dropped.push(name);
    return fallback;
  };

  const view: LibraryView = {
    filters: {
      topicId: field("topic", NO_LIBRARY_FILTERS.topicId),
      novelty: field("novelty", NO_LIBRARY_FILTERS.novelty),
      status: field("status", NO_LIBRARY_FILTERS.status),
      favourite: field("favourite", NO_LIBRARY_FILTERS.favourite),
      dubious: field("dubious", NO_LIBRARY_FILTERS.dubious),
      query: NO_LIBRARY_FILTERS.query,
    },
    sort: field("sort", DEFAULT_LIBRARY_SORT),
  };
  return { view, dropped };
}

export function writeLibraryView(
  accountId: string | null,
  { filters, sort }: LibraryView,
  storage: Storage = globalThis.localStorage,
): void {
  try {
    storage.setItem(
      storageKey(accountId),
      JSON.stringify({
        version: VERSION,
        topic: filters.topicId,
        novelty: filters.novelty,
        status: filters.status,
        favourite: filters.favourite,
        dubious: filters.dubious,
        sort,
      }),
    );
  } catch {
    return;
  }
}
