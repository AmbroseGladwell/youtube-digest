import { useDefaultApiUrl } from "../../app/DefaultApiUrlContext.js";
import { useSurface } from "../../app/SurfaceContext.js";
import { useSyncConnection } from "./useSyncConnection.js";

export const useKnownApiUrl = (): string | null => {
  const defaultApiUrl = useDefaultApiUrl();
  const surface = useSurface();
  const { connection } = useSyncConnection();
  return surface === "extension" ? (connection.apiUrl ?? defaultApiUrl) : (globalThis.location?.origin ?? null);
};
