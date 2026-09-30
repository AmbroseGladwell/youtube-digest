import { useDefaultApiUrl } from "../../app/DefaultApiUrlContext.js";
import { useSurface } from "../../app/SurfaceContext.js";
import { useSyncConnection } from "./useSyncConnection.js";

// The server this shell would talk to, signed in or not: the web app is served from it, and
// the extension has the one it was built for unless the reader named another.
export function useKnownApiUrl(): string | null {
  const defaultApiUrl = useDefaultApiUrl();
  const surface = useSurface();
  const { connection } = useSyncConnection();
  return surface === "extension" ? (connection.apiUrl ?? defaultApiUrl) : (globalThis.location?.origin ?? null);
}
