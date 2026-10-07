export const READ_SCOPE = "overviews:read";
export const WRITE_SCOPE = "overviews:write";
export const CONNECTION_SCOPES: readonly string[] = [READ_SCOPE, WRITE_SCOPE];

// Every connection reads, since that is what connecting is; the write scope lets it mark
// overviews as well. Asking for no scope asks for both, and asking for the read scope alone
// is honoured, which is what every connection made before the write scope existed holds
// (docs/features/mcp-connector.md, "Scopes").
export function grantedScope(requested: string | undefined): string | null {
  const asked = requested === undefined || requested.trim() === "" ? CONNECTION_SCOPES : requested.split(" ").filter((scope) => scope !== "");
  if (!asked.every((scope) => CONNECTION_SCOPES.includes(scope))) {
    return null;
  }
  return CONNECTION_SCOPES.filter((scope) => scope === READ_SCOPE || asked.includes(scope)).join(" ");
}

export const connectionWrites = (scope: string): boolean => scope.split(" ").includes(WRITE_SCOPE);
