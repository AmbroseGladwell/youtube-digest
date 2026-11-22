// What "queued" and "absent" mean: docs/features/account-deletion.md, "Erasure at PostHog".
export interface PersonEraser {
  erase(distinctId: string): Promise<"queued" | "absent">;
}
