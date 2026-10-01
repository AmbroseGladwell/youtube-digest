import type { McpAssistant } from "./analyticsEvents.js";

// Which assistant a connection is, from the name it registered with, which it chose itself:
// counted as one of a few, never passed on as written.
export function mcpAssistant(clientName: string | null): McpAssistant {
  const name = clientName?.toLowerCase() ?? "";
  if (name.includes("claude")) return "claude";
  if (name.includes("chatgpt") || name.includes("openai")) return "chatgpt";
  return "other";
}
