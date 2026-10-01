const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const mergeOneLevel = (key: string, base: Record<string, unknown>, patch: Record<string, unknown>) =>
  isObject(patch[key]) ? { [key]: { ...(isObject(base[key]) ? base[key] : {}), ...patch[key] } } : {};

// sectionsEnabled and milestones merge one level deep rather than being replaced: patching
// one toggle used to take the other three with it, and one device dismissing a milestone
// would take another's newly crossed one with it. One function, run by the local store,
// the server and the rebase, so the three cannot drift (docs/features/record-migrations.md).
export function mergeSettingsRecord(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...base,
    ...patch,
    ...mergeOneLevel("sectionsEnabled", base, patch),
    ...mergeOneLevel("milestones", base, patch),
  };
}
