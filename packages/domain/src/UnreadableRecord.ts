import { salvageOverview, type SalvagedOverview } from "./SalvagedOverview.js";

// future-version clears on update; the others need a migration (docs/features/record-migrations.md).
export type UnreadableReason = "future-version" | "unmigratable" | "invalid";

export type UnreadableRecordKind =
  | "overview"
  | "overviewState"
  | "topic"
  | "settings"
  | "followedPlaylist"
  | "project"
  | "projectMember"
  | "chat";

export interface UnreadableRecord {
  kind: UnreadableRecordKind;
  id: string;
  schemaVersion: number;
  reason: UnreadableReason;
  detail: string;
  salvaged: SalvagedOverview | null;
}

export interface UnreadableRecordFailure {
  reason: UnreadableReason;
  schemaVersion: number;
  detail: string;
}

export const unreadableRecord = (
  kind: UnreadableRecordKind,
  id: string,
  failure: UnreadableRecordFailure,
  raw: unknown,
): UnreadableRecord => {
  return {
    kind,
    id,
    schemaVersion: failure.schemaVersion,
    reason: failure.reason,
    detail: failure.detail,
    salvaged: kind === "overview" ? salvageOverview(raw) : null,
  };
};
