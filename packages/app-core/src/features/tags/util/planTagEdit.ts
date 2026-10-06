import { retagged, withTagAlias, type OverviewId, type TagAliases } from "@overview/domain";
import type { OverviewWithState } from "../../overviews/types/OverviewWithState.js";

// Merge, rename and delete are one operation: some tags become one tag, or none.
export interface TagEdit {
  from: string[];
  to: string | null;
}

export interface OverviewTagWrite {
  overviewId: OverviewId;
  tags?: string[];
  userTags?: string[];
}

export interface TagEditPlan {
  writes: OverviewTagWrite[];
  aliases: TagAliases;
}

export interface PlannedTagEdit {
  apply: TagEditPlan;
  // The exact state before, written back as it was, so Undo needs no inverse edit
  // ("OV-84 3 Manage Tags" 84m).
  undo: TagEditPlan;
  overviewsChanged: number;
}

const same = (left: readonly string[], right: readonly string[]) => left.join("\u0000") === right.join("\u0000");

export function planTagEdit(entries: readonly OverviewWithState[], aliases: TagAliases, edit: TagEdit): PlannedTagEdit {
  const from = new Set(edit.from);
  const apply: OverviewTagWrite[] = [];
  const undo: OverviewTagWrite[] = [];

  for (const { overview, state } of entries) {
    const tags = retagged(overview.tags, from, edit.to);
    const userTags = retagged(state.userTags, from, edit.to);
    const tagsChanged = !same(tags, overview.tags);
    const userTagsChanged = !same(userTags, state.userTags);
    if (!tagsChanged && !userTagsChanged) continue;
    apply.push({
      overviewId: overview.id,
      ...(tagsChanged ? { tags } : {}),
      ...(userTagsChanged ? { userTags } : {}),
    });
    undo.push({
      overviewId: overview.id,
      ...(tagsChanged ? { tags: overview.tags } : {}),
      ...(userTagsChanged ? { userTags: state.userTags } : {}),
    });
  }

  const nextAliases = edit.from
    .filter((tag) => tag !== edit.to)
    .reduce((current, tag) => withTagAlias(current, tag, edit.to), aliases);

  return {
    apply: { writes: apply, aliases: nextAliases },
    undo: { writes: undo, aliases },
    overviewsChanged: apply.length,
  };
}

// The plan as the caches should read once it lands, for the optimistic paint.
export function applyTagEditPlan<T extends OverviewWithState>(entry: T, plan: TagEditPlan): T {
  const write = plan.writes.find(({ overviewId }) => overviewId === entry.overview.id);
  if (write === undefined) return entry;
  return {
    ...entry,
    overview: write.tags === undefined ? entry.overview : { ...entry.overview, tags: write.tags },
    state: write.userTags === undefined ? entry.state : { ...entry.state, userTags: write.userTags },
  };
}
