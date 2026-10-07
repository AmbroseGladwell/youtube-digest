import assert from "node:assert/strict";
import type { LightMyRequestResponse } from "fastify";
import { makeConnectingAssistant, type TokenSet } from "../oauth/ConnectingAssistant.testHelper.js";
import type { TestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount, type TestAccount } from "../testing/TestAccount.testHelper.js";
import type { SampleLibrary } from "../testing/sampleLibrary.testHelper.js";

export interface ToolResult {
  text: string;
  isError: boolean;
}

export interface McpClient {
  tokens: TokenSet;
  post(message: unknown, headers?: Record<string, string>): Promise<LightMyRequestResponse>;
  request(method: string, params?: Record<string, unknown>): Promise<Record<string, unknown>>;
  callTool(name: string, args?: Record<string, unknown>): Promise<ToolResult>;
}

export async function seedLibrary(account: TestAccount, library: SampleLibrary): Promise<void> {
  for (const topic of library.topics) {
    const response = await account.inject({ method: "POST", url: "/api/topics", body: topic });
    assert.equal(response.statusCode, 201, response.body);
  }
  for (const { overview } of library.notes) {
    const response = await account.inject({ method: "POST", url: "/api/overviews", body: overview });
    assert.equal(response.statusCode, 201, response.body);
  }
}

// An assistant connected to the reader's account the way Claude connects, talking to /mcp
// with the access token it was given; asking for the read scope alone connects as every
// connection from before the write scope did (docs/features/mcp-connector.md).
export async function connectMcpClient(testApp: TestApp, account: TestAccount, scope?: string): Promise<McpClient> {
  const assistant = await makeConnectingAssistant(testApp);
  const tokens = await assistant.connect(account, scope === undefined ? {} : { scope });
  let nextId = 1;

  const post = (message: unknown, headers: Record<string, string> = {}) =>
    testApp.app.inject({
      method: "POST",
      url: "/mcp",
      headers: { authorization: `Bearer ${tokens.access_token}`, accept: "application/json, text/event-stream", ...headers },
      payload: message as object,
    });

  const request = async (method: string, params: Record<string, unknown> = {}) => {
    const id = nextId++;
    const response = await post({ jsonrpc: "2.0", id, method, params });
    assert.equal(response.statusCode, 200, response.body);
    const body = response.json();
    assert.equal(body.id, id);
    assert.equal(body.error, undefined, JSON.stringify(body.error));
    return body.result as Record<string, unknown>;
  };

  return {
    tokens,
    post,
    request,
    callTool: async (name, args = {}) => {
      const result = (await request("tools/call", { name, arguments: args })) as {
        content: Array<{ type: string; text: string }>;
        isError: boolean;
      };
      assert.equal(result.content.length, 1);
      return { text: result.content[0]!.text, isError: result.isError };
    },
  };
}
