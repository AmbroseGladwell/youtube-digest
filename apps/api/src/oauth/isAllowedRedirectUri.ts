const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

// https anywhere, plain http only back to the caller's own machine, and never a fragment
// (docs/features/mcp-connector.md, "Registering a client").
export function isAllowedRedirectUri(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.hash !== "" || value.includes("#") || url.username !== "" || url.password !== "") {
    return false;
  }
  return url.protocol === "https:" || (url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname));
}
