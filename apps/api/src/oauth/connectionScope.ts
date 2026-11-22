export const READ_SCOPE = "overviews:read";
export const WRITE_SCOPE = "overviews:write";
export const PROFILE_SCOPE = "profile:read";
export const CONNECTION_SCOPES: readonly string[] = [READ_SCOPE, WRITE_SCOPE, PROFILE_SCOPE];

// The whole scope rule: docs/features/mcp-connector.md, "Scopes".
export const grantedScope = (requested: string | undefined): string | null => {
  const asked =
    requested === undefined || requested.trim() === "" ? CONNECTION_SCOPES : requested.split(" ").filter((scope) => scope !== "");
  if (!asked.every((scope) => CONNECTION_SCOPES.includes(scope))) {
    return null;
  }
  return CONNECTION_SCOPES.filter((scope) => scope === READ_SCOPE || asked.includes(scope)).join(" ");
};

const holds = (scope: string, wanted: string): boolean => scope.split(" ").includes(wanted);

export const connectionWrites = (scope: string): boolean => holds(scope, WRITE_SCOPE);

export const connectionReadsProfile = (scope: string): boolean => holds(scope, PROFILE_SCOPE);
