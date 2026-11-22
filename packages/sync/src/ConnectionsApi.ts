import type { Connection, ConnectionDecided, ConnectionRequest } from "@overview/domain";

export interface ConnectionsApi {
  request(requestId: string): Promise<ConnectionRequest>;
  decide(requestId: string, approve: boolean): Promise<ConnectionDecided>;
  list(): Promise<Connection[]>;
  revoke(connectionId: string): Promise<void>;
}
