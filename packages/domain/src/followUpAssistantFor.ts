import type { Connection } from "./Connection.js";
import { connectionAssistant, type ChosenAssistant, type FollowUpAssistant } from "./FollowUpAssistant.js";

export interface FollowUpAssistantChoice {
  assistant: FollowUpAssistant | null;
  connected: boolean;
}

// Which assistant a question opens: the reader's choice, or, before they've made one, the one
// assistant their connections are to. Null asks them to pick. "Other" is no choice for questions.
export function followUpAssistantFor(choice: ChosenAssistant | null, connections: readonly Connection[]): FollowUpAssistantChoice {
  const chosen = choice === "other" ? null : choice;
  const connectedTo = new Set(connections.map((connection) => connectionAssistant(connection.clientName)).filter((name) => name !== null));
  const assistant = chosen ?? (connectedTo.size === 1 ? [...connectedTo][0]! : null);
  return { assistant, connected: assistant !== null && connectedTo.has(assistant) };
}
