import type { Connection, ConnectionDecided, ConnectionRequest } from "@overview/domain";

// The reader's half of connecting an assistant: answering a request on the consent screen,
// and seeing or revoking connections in Settings (docs/features/mcp-connector.md).
export interface ConnectionsApi {
  request(requestId: string): Promise<ConnectionRequest>;
  decide(requestId: string, approve: boolean): Promise<ConnectionDecided>;
  list(): Promise<Connection[]>;
  revoke(connectionId: string): Promise<void>;
}
