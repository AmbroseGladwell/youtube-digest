import { useConnectionsQuery } from "../connections/queries/connectionsQuery.js";

export interface AssistantConnections {
  // Any connection: the lines about an assistant working from a project show only then.
  any: boolean;
  // One that can change the library: an empty project offers it the job of filling it.
  writes: boolean;
}

// Unknown until the list arrives, and taken as none, so nothing promises an assistant that
// isn't there (docs/features/projects.md, "The project page").
export function useAssistantConnections(): AssistantConnections {
  const connections = useConnectionsQuery().data ?? [];
  return { any: connections.length > 0, writes: connections.some((connection) => connection.writes) };
}
