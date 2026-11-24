import { z } from "zod";
import { Novelty, TopicId } from "@overview/domain";
import { LIBRARY_ADDED, LIBRARY_KINDS, NO_LIBRARY_FILTERS } from "./types/LibraryFilters.js";
import { DEFAULT_LIBRARY_SORT, LIBRARY_SORTS } from "./types/LibrarySort.js";
import type { LibraryView, SavedLibraryViewField } from "./types/LibraryView.js";

const VERSION = 2;
const NO_ACCOUNT = "noAccount";

const SavedLibraryView = z.looseObject({ version: z.union([z.literal(1), z.literal(VERSION)]) });

const FIELDS = {
  kinds: z.array(z.enum(LIBRARY_KINDS)),
  added: z.enum(LIBRARY_ADDED),
  topic: z.union([TopicId, z.literal("all"), z.literal("none")]),
  novelties: z.array(Novelty),
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

// Version 1 held one kind as source and one verdict as novelty: docs/features/library-filters.md, "Saved view".
const fromVersion1 = ({ source, novelty, ...rest }: Record<string, unknown>): Record<string, unknown> => ({
  ...rest,
  kinds: source === undefined || source === "all" ? [] : [source],
  novelties: novelty === undefined || novelty === "all" ? [] : [novelty],
  added: NO_LIBRARY_FILTERS.added,
});

// Never synced, and neither the search, a tag nor a source is kept: docs/features/library-view.md, "Where it lives".
export const readLibraryView = (accountId: string | null, storage: Storage = globalThis.localStorage): RestoredLibraryView | null => {
  let saved: Record<string, unknown>;
  try {
    const raw = storage.getItem(storageKey(accountId));
    if (!raw) {
      return null;
    }
    const parsed = SavedLibraryView.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return null;
    }
    saved = parsed.data.version === 1 ? fromVersion1(parsed.data) : parsed.data;
  } catch {
    return null;
  }

  const dropped: SavedLibraryViewField[] = [];
  const field = <K extends SavedLibraryViewField>(name: K, fallback: z.infer<(typeof FIELDS)[K]>) => {
    const parsed = FIELDS[name].safeParse(saved[name]);
    if (parsed.success) {
      return parsed.data as z.infer<(typeof FIELDS)[K]>;
    }
    dropped.push(name);
    return fallback;
  };

  const view: LibraryView = {
    filters: {
      kinds: field("kinds", NO_LIBRARY_FILTERS.kinds),
      sources: NO_LIBRARY_FILTERS.sources,
      added: field("added", NO_LIBRARY_FILTERS.added),
      topicId: field("topic", NO_LIBRARY_FILTERS.topicId),
      novelties: field("novelties", NO_LIBRARY_FILTERS.novelties),
      status: field("status", NO_LIBRARY_FILTERS.status),
      favourite: field("favourite", NO_LIBRARY_FILTERS.favourite),
      withoutOverview: NO_LIBRARY_FILTERS.withoutOverview,
      dubious: field("dubious", NO_LIBRARY_FILTERS.dubious),
      tags: NO_LIBRARY_FILTERS.tags,
      query: NO_LIBRARY_FILTERS.query,
    },
    sort: field("sort", DEFAULT_LIBRARY_SORT),
  };
  return { view, dropped };
};

export const writeLibraryView = (
  accountId: string | null,
  { filters, sort }: LibraryView,
  storage: Storage = globalThis.localStorage,
): void => {
  try {
    storage.setItem(
      storageKey(accountId),
      JSON.stringify({
        version: VERSION,
        kinds: filters.kinds,
        added: filters.added,
        topic: filters.topicId,
        novelties: filters.novelties,
        status: filters.status,
        favourite: filters.favourite,
        dubious: filters.dubious,
        sort,
      }),
    );
  } catch {
    return;
  }
};

export const forgetLibraryView = (accountId: string, storage: Storage = globalThis.localStorage): void => {
  try {
    storage.removeItem(storageKey(accountId));
  } catch {
    return;
  }
};
