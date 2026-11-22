const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

// Why these: docs/features/mcp-connector.md, "Registering a client".
export const isAllowedRedirectUri = (value: string): boolean => {
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
};
