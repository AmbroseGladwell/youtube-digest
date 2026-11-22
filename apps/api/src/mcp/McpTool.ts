import type { FastifyBaseLogger } from "fastify";
import { z } from "zod";
import type { AccountId } from "../auth/AccountId.js";
import type { SqlClient } from "../db/SqlClient.js";
import type { MeaningSearch } from "../meaning/MeaningSearch.js";
import type { RecordsRepository } from "../records/RecordsRepository.js";
import type { TranscriptsRepository } from "../transcripts/TranscriptsRepository.js";

export interface McpToolContext {
  sql: SqlClient;
  accountId: AccountId;
  transcripts: TranscriptsRepository;
  records: RecordsRepository;
  // Null without an embedder: docs/features/search-by-meaning.md, "Degrading visibly".
  meaning: MeaningSearch | null;
  clock: () => Date;
  log: FastifyBaseLogger;
  // For marking what it adds: docs/features/mcp-connector.md, "Projects".
  connection: { id: string; name: string };
  // From the connection's scope: docs/features/mcp-connector.md, "Scopes".
  writes: boolean;
}

// What a call logs, never the query or content: docs/features/mcp-connector.md, "Logging".
export interface McpToolOutcome {
  text: string;
  isError?: boolean;
  overviews?: number;
  // Logged to measure whether a purpose makes a project read more: docs/features/projects.md, "Measures".
  project?: { id: string; hasPurpose: boolean };
}

export interface McpTool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  writes: boolean;
  idempotent: boolean;
  readsProfile: boolean;
  call(args: unknown, context: McpToolContext): Promise<McpToolOutcome>;
}

export const toolError = (text: string): McpToolOutcome => ({ text, isError: true });

export interface McpToolDefinition<Input extends z.ZodObject> {
  name: string;
  title: string;
  description: string;
  input: Input;
  writes?: boolean;
  idempotent?: boolean;
  readsProfile?: boolean;
  run(input: z.infer<Input>, context: McpToolContext): Promise<McpToolOutcome>;
}

// Bad arguments fail the call, not the protocol: docs/features/mcp-connector.md, "The endpoint".
export const mcpTool = <Input extends z.ZodObject>(tool: McpToolDefinition<Input>): McpTool => {
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: z.toJSONSchema(tool.input, { io: "input" }),
    writes: tool.writes ?? false,
    idempotent: tool.idempotent ?? true,
    readsProfile: tool.readsProfile ?? false,
    call: async (args, context) => {
      const parsed = tool.input.safeParse(args ?? {});
      if (!parsed.success) {
        return toolError(`The arguments do not fit this tool: ${z.prettifyError(parsed.error)}`);
      }
      return tool.run(parsed.data, context);
    },
  };
};
