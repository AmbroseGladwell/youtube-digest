import type { FastifyBaseLogger } from "fastify";
import { z } from "zod";
import type { McpAssistant } from "./mcpAssistant.js";
import { mcpPrompts } from "./mcpPrompts.js";
import type { McpToolContext } from "./McpTool.js";
import { mcpTools } from "./mcpTools.js";

export const MCP_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"];

export const JSON_RPC_ERRORS = {
  parseError: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internalError: -32603,
} as const;

const RequestId = z.union([z.string(), z.number()]);
type RequestId = z.infer<typeof RequestId>;

const JsonRpcMessage = z.object({
  jsonrpc: z.literal("2.0"),
  id: RequestId.optional(),
  method: z.string().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
});

const InitializeParams = z.object({ protocolVersion: z.string() });
const CallParams = z.object({ name: z.string(), arguments: z.record(z.string(), z.unknown()).optional() });
const PromptParams = z.object({ name: z.string(), arguments: z.record(z.string(), z.string()).optional() });

export type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: RequestId | null; result: Record<string, unknown> }
  | { jsonrpc: "2.0"; id: RequestId | null; error: { code: number; message: string } };

export type McpReply = { kind: "accepted" } | { kind: "response"; body: JsonRpcResponse };

export interface McpCallContext extends McpToolContext {
  connectionId: string;
  assistant: McpAssistant;
  log: FastifyBaseLogger;
}

const INSTRUCTIONS =
  "These tools read the reader's own library of saved YouTube video overviews: short, blunt notes on what each video claims and whether it holds up. " +
  "Find overviews with search_overviews or list_topics, then read them in full with get_overview, or many at once with get_overviews to compare or combine what several videos say. " +
  "Use get_transcript only to check what a video actually said. Cite the video's title and the timestamp links the notes carry.";

class JsonRpcError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
  }
}

export const jsonRpcError = (id: RequestId | null, code: number, message: string): JsonRpcResponse => ({
  jsonrpc: "2.0",
  id,
  error: { code, message },
});

function paramsOf<T>(schema: z.ZodType<T>, params: unknown): T {
  const parsed = schema.safeParse(params ?? {});
  if (!parsed.success) {
    throw new JsonRpcError(JSON_RPC_ERRORS.invalidParams, z.prettifyError(parsed.error));
  }
  return parsed.data;
}

async function callTool(params: unknown, context: McpCallContext): Promise<Record<string, unknown>> {
  const { name, arguments: args } = paramsOf(CallParams, params);
  const tool = mcpTools.find((candidate) => candidate.name === name);
  if (tool === undefined) {
    throw new JsonRpcError(JSON_RPC_ERRORS.invalidParams, `Unknown tool: ${name}`);
  }
  const logged = { connectionId: context.connectionId, assistant: context.assistant, tool: name };
  const startedAt = performance.now();
  const durationMs = () => Math.round(performance.now() - startedAt);
  try {
    const outcome = await tool.call(args, context);
    context.log.info(
      { ...logged, overviews: outcome.overviews ?? null, failed: outcome.isError === true, durationMs: durationMs() },
      "mcp tool called",
    );
    return { content: [{ type: "text", text: outcome.text }], isError: outcome.isError === true };
  } catch (error) {
    context.log.error({ ...logged, err: error, durationMs: durationMs() }, "mcp tool failed");
    return { content: [{ type: "text", text: "Something went wrong reading the library. Try again shortly." }], isError: true };
  }
}

function getPrompt(params: unknown): Record<string, unknown> {
  const { name, arguments: args = {} } = paramsOf(PromptParams, params);
  const prompt = mcpPrompts.find((candidate) => candidate.name === name);
  if (prompt === undefined) {
    throw new JsonRpcError(JSON_RPC_ERRORS.invalidParams, `Unknown prompt: ${name}`);
  }
  const missing = prompt.arguments.filter((argument) => argument.required && !args[argument.name]?.trim());
  if (missing.length > 0) {
    throw new JsonRpcError(JSON_RPC_ERRORS.invalidParams, `Missing: ${missing.map((argument) => argument.name).join(", ")}`);
  }
  return {
    description: prompt.description,
    messages: [{ role: "user", content: { type: "text", text: prompt.text(args) } }],
  };
}

async function answer(method: string, params: unknown, context: McpCallContext): Promise<Record<string, unknown>> {
  switch (method) {
    case "initialize": {
      const { protocolVersion } = paramsOf(InitializeParams, params);
      return {
        protocolVersion: MCP_PROTOCOL_VERSIONS.includes(protocolVersion) ? protocolVersion : MCP_PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false }, prompts: { listChanged: false } },
        serverInfo: { name: "overview", title: "Overview", version: "1.0.0" },
        instructions: INSTRUCTIONS,
      };
    }
    case "ping":
      return {};
    case "tools/list":
      return {
        tools: mcpTools.map(({ name, title, description, inputSchema }) => ({
          name,
          title,
          description,
          inputSchema,
          annotations: { title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        })),
      };
    case "tools/call":
      return callTool(params, context);
    case "prompts/list":
      return {
        prompts: mcpPrompts.map(({ name, title, description, arguments: args }) => ({ name, title, description, arguments: args })),
      };
    case "prompts/get":
      return getPrompt(params);
    default:
      throw new JsonRpcError(JSON_RPC_ERRORS.methodNotFound, `Method not found: ${method}`);
  }
}

// Stateless Streamable HTTP: every request is answered as one JSON body, and nothing is
// ever sent unasked, so a notification or a client's response needs only accepting
// (docs/features/mcp-connector.md, "The endpoint").
export async function handleMcpMessage(message: unknown, context: McpCallContext): Promise<McpReply> {
  if (Array.isArray(message)) {
    return { kind: "response", body: jsonRpcError(null, JSON_RPC_ERRORS.invalidRequest, "Batches are not supported") };
  }
  const parsed = JsonRpcMessage.safeParse(message);
  if (!parsed.success) {
    return { kind: "response", body: jsonRpcError(null, JSON_RPC_ERRORS.invalidRequest, "Not a JSON-RPC 2.0 message") };
  }
  const { id, method, params } = parsed.data;
  if (id === undefined || method === undefined) {
    return { kind: "accepted" };
  }
  try {
    return { kind: "response", body: { jsonrpc: "2.0", id, result: await answer(method, params, context) } };
  } catch (error) {
    if (error instanceof JsonRpcError) {
      return { kind: "response", body: jsonRpcError(id, error.code, error.message) };
    }
    throw error;
  }
}
