const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const mergeOneLevel = (key: string, base: Record<string, unknown>, patch: Record<string, unknown>) =>
  isObject(patch[key]) ? { [key]: { ...(isObject(base[key]) ? base[key] : {}), ...patch[key] } } : {};

// docs/features/record-migrations.md, "Writes are field-scoped, not whole-record".
export const mergeSettingsRecord = (base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> => {
  return {
    ...base,
    ...patch,
    ...mergeOneLevel("sectionsEnabled", base, patch),
    ...mergeOneLevel("milestones", base, patch),
    ...mergeOneLevel("modelByProvider", base, patch),
    ...mergeOneLevel("learned", base, patch),
    ...mergeOneLevel("planPromptsDismissed", base, patch),
    ...mergeOneLevel("topicAliases", base, patch),
  };
};
