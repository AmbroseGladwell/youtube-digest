// Asks the analytics processor to erase everything held under one distinct id: the person
// and every event and error report beneath it. "queued" because PostHog deletes the person
// in minutes and the events in a later scheduled run, never at once; "absent" when nothing
// was ever recorded under the id (docs/features/account-deletion.md).
export interface PersonEraser {
  erase(distinctId: string): Promise<"queued" | "absent">;
}
