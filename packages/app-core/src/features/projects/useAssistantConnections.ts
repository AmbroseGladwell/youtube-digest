import { useConnectionsQuery } from "../connections/queries/connectionsQuery.js";

export interface AssistantConnections {
  // Any connection: the lines about an assistant working from a project show only then.
  any: boolean;
  // One that can change the library: an empty project offers it the job of filling it.
  writes: boolean;
  // What the first one that can is called, for "Or have Claude look for you" ("OV-318 1" 318a).
  writerName: string | null;
}

// Unknown until the list arrives, and taken as none, so nothing promises an assistant that
// isn't there (docs/features/projects.md, "The project page").
export function useAssistantConnections(): AssistantConnections {
  const connections = useConnectionsQuery().data ?? [];
  const writer = connections.find((connection) => connection.writes);
  return { any: connections.length > 0, writes: writer !== undefined, writerName: writer?.clientName ?? null };
}
