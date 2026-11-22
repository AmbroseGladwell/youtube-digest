import { connectionAssistant, type FollowUpAssistant } from "@overview/domain";

export type McpAssistant = FollowUpAssistant | "other";

// Which assistant a connection is, from the name it registered with, which it chose itself:
// logged as one of a few, never as written (docs/features/mcp-connector.md, "Logging").
export const mcpAssistant = (clientName: string | null): McpAssistant => {
  return connectionAssistant(clientName) ?? "other";
};
