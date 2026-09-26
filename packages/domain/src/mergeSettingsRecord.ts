const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

// sectionsEnabled merges one level deep rather than being replaced: patching one toggle
// used to take the other three with it, and would take a newer client's toggles with it
// too. One function, run by the local store, the server and the rebase, so the three
// cannot drift (docs/features/record-migrations.md).
export function mergeSettingsRecord(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...base,
    ...patch,
    ...(isObject(patch.sectionsEnabled)
      ? {
          sectionsEnabled: {
            ...(isObject(base.sectionsEnabled) ? base.sectionsEnabled : {}),
            ...patch.sectionsEnabled,
          },
        }
      : {}),
  };
}
