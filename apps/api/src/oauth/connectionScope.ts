export const READ_SCOPE = "overviews:read";
export const WRITE_SCOPE = "overviews:write";
export const PROFILE_SCOPE = "profile:read";
export const CONNECTION_SCOPES: readonly string[] = [READ_SCOPE, WRITE_SCOPE, PROFILE_SCOPE];

// Every connection reads, since that is what connecting is; the write scope lets it mark
// overviews as well, and the profile scope lets it read what is known about the reader.
// Asking for no scope asks for all three, and asking for fewer is honoured, which is what
// every connection made before a scope existed holds (docs/features/mcp-connector.md, "Scopes").
export function grantedScope(requested: string | undefined): string | null {
  const asked =
    requested === undefined || requested.trim() === "" ? CONNECTION_SCOPES : requested.split(" ").filter((scope) => scope !== "");
  if (!asked.every((scope) => CONNECTION_SCOPES.includes(scope))) {
    return null;
  }
  return CONNECTION_SCOPES.filter((scope) => scope === READ_SCOPE || asked.includes(scope)).join(" ");
}

const holds = (scope: string, wanted: string): boolean => scope.split(" ").includes(wanted);

export const connectionWrites = (scope: string): boolean => holds(scope, WRITE_SCOPE);

export const connectionReadsProfile = (scope: string): boolean => holds(scope, PROFILE_SCOPE);
