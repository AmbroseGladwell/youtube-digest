import { useMemo, type ReactNode } from "react";
import { createFetchShareApi } from "@overview/sync";
import { useSync } from "../sync/SyncContext.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { ShareApiProvider } from "./ShareApiContext.js";
import { useClientSurface } from "../../app/SurfaceContext.js";

// Inside the sync runtime, because a shared link belongs to an account and is found again
// through its session (docs/features/sharing.md).
export function ShareRuntime({ children }: { children: ReactNode }) {
  const { connected } = useSync();
  const { apiUrl, token } = useSyncConnection().connection;
  const surface = useClientSurface();
  const api = useMemo(
    () => (connected && apiUrl !== null ? createFetchShareApi({ baseUrl: apiUrl, token, surface }) : null),
    [connected, apiUrl, token, surface],
  );

  return <ShareApiProvider value={api}>{children}</ShareApiProvider>;
}
