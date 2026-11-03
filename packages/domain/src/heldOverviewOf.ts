import type { SourceKey } from "./Brands.js";
import type { OverviewStore } from "./OverviewStore.js";
import { sourceKey } from "./sourceKey.js";

export interface HeldOverview {
  id: string;
  // False for a record this app cannot read: it is still one the reader owns, and offering
  // to generate it again is offering to buy it twice (docs/features/record-migrations.md).
  readable: boolean;
}

// Whether a library already holds an overview of a source, quarantined records included, by
// their salvaged source. Null is "no", never "could not tell": a store that cannot answer
// throws (docs/features/one-overview-per-video.md).
export async function heldOverviewOf(
  store: Pick<OverviewStore, "listOverviews" | "listUnreadable">,
  key: SourceKey | string,
): Promise<HeldOverview | null> {
  const [overviews, unreadable] = await Promise.all([store.listOverviews(), store.listUnreadable()]);
  const readable = overviews.find((overview) => sourceKey(overview.source) === key);
  if (readable !== undefined) return { id: readable.id, readable: true };
  const quarantined = unreadable.find(
    ({ kind, salvaged }) => kind === "overview" && salvaged?.source != null && sourceKey(salvaged.source) === key,
  );
  return quarantined === undefined ? null : { id: quarantined.id, readable: false };
}
