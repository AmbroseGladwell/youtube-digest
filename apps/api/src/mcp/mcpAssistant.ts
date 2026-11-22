import { connectionAssistant, type FollowUpAssistant } from "@overview/domain";

export type McpAssistant = FollowUpAssistant | "other";

// Logged as one of a few, never as the name it chose: docs/features/mcp-connector.md, "Logging".
export const mcpAssistant = (clientName: string | null): McpAssistant => {
  return connectionAssistant(clientName) ?? "other";
};
