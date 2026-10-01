export type McpAssistant = "claude" | "chatgpt" | "other";

// Which assistant a connection is, from the name it registered with, which it chose itself:
// logged as one of a few, never as written (docs/features/mcp-connector.md, "Logging").
export function mcpAssistant(clientName: string | null): McpAssistant {
  const name = clientName?.toLowerCase() ?? "";
  if (name.includes("claude")) return "claude";
  if (name.includes("chatgpt") || name.includes("openai")) return "chatgpt";
  return "other";
}
