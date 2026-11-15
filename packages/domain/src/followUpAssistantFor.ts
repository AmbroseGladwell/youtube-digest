import type { Connection } from "./Connection.js";
import { connectionAssistant, type FollowUpAssistant } from "./FollowUpAssistant.js";

export interface FollowUpAssistantChoice {
  assistant: FollowUpAssistant | null;
  connected: boolean;
}

// Which assistant a question opens: the reader's choice, or, before they've made one, the one
// assistant their connections are to. Null asks them to pick.
export function followUpAssistantFor(chosen: FollowUpAssistant | null, connections: readonly Connection[]): FollowUpAssistantChoice {
  const connectedTo = new Set(connections.map((connection) => connectionAssistant(connection.clientName)).filter((name) => name !== null));
  const assistant = chosen ?? (connectedTo.size === 1 ? [...connectedTo][0]! : null);
  return { assistant, connected: assistant !== null && connectedTo.has(assistant) };
}
