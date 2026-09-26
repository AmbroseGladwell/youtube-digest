export type WriteDecision =
  | { action: "upsert"; body: Record<string, unknown>; schemaVersion: number; updatedAt: string }
  | { action: "tombstone" }
  | { action: "nothing" };
