import type { FastifyBaseLogger } from "fastify";
import { z } from "zod";
import type { AccountId } from "../auth/AccountId.js";
import type { SqlClient } from "../db/SqlClient.js";
import type { RecordsRepository } from "../records/RecordsRepository.js";
import type { TranscriptsRepository } from "../transcripts/TranscriptsRepository.js";

export interface McpToolContext {
  sql: SqlClient;
  accountId: AccountId;
  transcripts: TranscriptsRepository;
  records: RecordsRepository;
  clock: () => Date;
  log: FastifyBaseLogger;
}

// `overviews` is how many a call returned or marked, the one number about a call that is
// logged besides its name: never the query or the content (docs/features/mcp-connector.md).
export interface McpToolOutcome {
  text: string;
  isError?: boolean;
  overviews?: number;
}

// A tool that writes is offered only to a connection whose scope allows it
// (docs/features/mcp-connector.md, "Scopes").
export interface McpTool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  writes: boolean;
  call(args: unknown, context: McpToolContext): Promise<McpToolOutcome>;
}

export const toolError = (text: string): McpToolOutcome => ({ text, isError: true });

// Arguments that do not fit are answered as a failed call rather than a protocol error, so
// the assistant reads why and can try again (MCP 2025-11-25, "Error Handling").
export function mcpTool<Input extends z.ZodObject>(tool: {
  name: string;
  title: string;
  description: string;
  input: Input;
  writes?: boolean;
  run(input: z.infer<Input>, context: McpToolContext): Promise<McpToolOutcome>;
}): McpTool {
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: z.toJSONSchema(tool.input, { io: "input" }),
    writes: tool.writes ?? false,
    call: async (args, context) => {
      const parsed = tool.input.safeParse(args ?? {});
      if (!parsed.success) {
        return toolError(`The arguments do not fit this tool: ${z.prettifyError(parsed.error)}`);
      }
      return tool.run(parsed.data, context);
    },
  };
}
