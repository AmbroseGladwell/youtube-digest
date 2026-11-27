const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

export const topicAliasesIn = (settingsBody: Record<string, unknown> | null | undefined): Record<string, string | null> => {
  const aliases = settingsBody?.topicAliases;
  if (!isObject(aliases)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(aliases).filter((entry): entry is [string, string | null] => typeof entry[1] === "string" || entry[1] === null),
  );
};
