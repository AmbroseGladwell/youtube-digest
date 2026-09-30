import { z } from "zod";
import { ConnectionDecided, ConnectionRequest, Connections } from "@overview/domain";
import { answered, createApiRequester, type ApiRequesterOptions } from "./apiRequest.js";
import type { ConnectionsApi } from "./ConnectionsApi.js";

export type FetchConnectionsApiOptions = ApiRequesterOptions;

export function createFetchConnectionsApi(options: FetchConnectionsApiOptions): ConnectionsApi {
  const request = createApiRequester(options);
  const requestPath = (requestId: string) => `/oauth/requests/${encodeURIComponent(requestId)}`;

  return {
    request: (requestId) => answered(request("GET", requestPath(requestId), ConnectionRequest)),
    decide: (requestId, approve) =>
      answered(request("POST", `${requestPath(requestId)}/decision`, ConnectionDecided, { body: { approve } })),
    list: async () => (await answered(request("GET", "/connections", Connections))).connections,
    revoke: async (connectionId) => {
      await request("DELETE", `/connections/${encodeURIComponent(connectionId)}`, z.never());
    },
  };
}
