import { useConnectionsQuery } from "../connections/queries/connectionsQuery.js";

export interface AssistantConnections {
  any: boolean;
  writes: boolean;
  writerName: string | null;
}

// Taken as none until the list arrives, so nothing promises an assistant that isn't there.
export const useAssistantConnections = (): AssistantConnections => {
  const connections = useConnectionsQuery().data ?? [];
  const writer = connections.find((connection) => connection.writes);
  return { any: connections.length > 0, writes: writer !== undefined, writerName: writer?.clientName ?? null };
};
