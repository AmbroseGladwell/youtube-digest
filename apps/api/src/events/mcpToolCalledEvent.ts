import { z } from "zod";
import { mcpAssistant, serverAnalyticsEvents } from "@overview/domain";
import type { McpToolCall } from "../mcp/handleMcpMessage.js";
import type { SinkEvent } from "./EventSink.js";

const ToolCalledProps = z.object(serverAnalyticsEvents.mcp.toolCalled.props).strict();

// A tool that returns no overviews counts zero; a call is never longer than the catalogue
// allows, so a stuck one still counts (docs/architecture/analytics.md, "Events the server sends").
export function mcpToolCalledEvent(call: McpToolCall, clientName: string | null, at: Date): SinkEvent | null {
  const props = ToolCalledProps.safeParse({
    tool: call.tool,
    assistant: mcpAssistant(clientName),
    failed: call.failed,
    overviews: Math.min(call.overviews ?? 0, 1_000),
    durationMs: Math.min(call.durationMs, 600_000),
  });
  return props.success ? { name: "mcp.toolCalled", props: props.data, at: at.toISOString() } : null;
}
