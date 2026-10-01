import test from "node:test";
import assert from "node:assert/strict";
import { putOnPlan } from "../oauth/ConnectingAssistant.testHelper.js";
import { ACCESS_TOKEN_TTL_MS } from "../oauth/connectionTimings.js";
import { rateLimits } from "../rateLimit/rateLimits.js";
import { createTestApp, TEST_APP_URL } from "../testing/createTestApp.testHelper.js";
import { storedOverview } from "../testing/storedRecords.testHelper.js";
import { makeAccount } from "../testing/TestAccount.testHelper.js";
import { connectMcpClient, plusAccount } from "./McpClient.testHelper.js";

const INITIALIZE = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } },
};

test("a request with no token is turned away with the metadata a client follows to connect", async () => {
  const testApp = await createTestApp();

  const response = await testApp.app.inject({ method: "POST", url: "/mcp", payload: INITIALIZE });

  assert.equal(response.statusCode, 401);
  assert.equal(
    response.headers["www-authenticate"],
    `Bearer resource_metadata="${TEST_APP_URL}/.well-known/oauth-protected-resource/mcp", scope="overviews:read"`,
  );
  await testApp.close();
});

test("a reader's session token is not a connection's token, and opens nothing here", async () => {
  const testApp = await createTestApp();
  const reader = await plusAccount(testApp);

  const response = await testApp.app.inject({ method: "POST", url: "/mcp", headers: reader.headers, payload: INITIALIZE });

  assert.equal(response.statusCode, 401);
  assert.match(response.headers["www-authenticate"] as string, /error="invalid_token"/);
  await testApp.close();
});

test("initialize agrees the client's protocol version and offers read-only tools and a prompt", async () => {
  const testApp = await createTestApp();
  const client = await connectMcpClient(testApp, await plusAccount(testApp));

  const response = await client.post(INITIALIZE);

  assert.equal(response.statusCode, 200);
  const { result } = response.json();
  assert.equal(result.protocolVersion, "2025-06-18");
  assert.deepEqual(Object.keys(result.capabilities).sort(), ["prompts", "tools"]);
  assert.equal(typeof result.instructions, "string");
  await testApp.close();
});

test("initialize answers with its own latest version when it does not know the client's", async () => {
  const testApp = await createTestApp();
  const client = await connectMcpClient(testApp, await plusAccount(testApp));

  const result = await client.request("initialize", { protocolVersion: "2024-01-01", capabilities: {} });

  assert.equal(result.protocolVersion, "2025-11-25");
  await testApp.close();
});

test("tools/list offers the five tools, each marked read-only, with a schema for its arguments", async () => {
  const testApp = await createTestApp();
  const client = await connectMcpClient(testApp, await plusAccount(testApp));

  const { tools } = (await client.request("tools/list")) as {
    tools: Array<{ name: string; inputSchema: { type: string }; annotations: { readOnlyHint: boolean } }>;
  };

  assert.deepEqual(
    tools.map((tool) => tool.name),
    ["search_overviews", "list_topics", "get_overview", "get_overviews", "get_transcript"],
  );
  assert.ok(tools.every((tool) => tool.annotations.readOnlyHint && tool.inputSchema.type === "object"));
  await testApp.close();
});

test("the compare prompt names the topic it was given and asks for citations", async () => {
  const testApp = await createTestApp();
  const client = await connectMcpClient(testApp, await plusAccount(testApp));

  const listed = (await client.request("prompts/list")) as { prompts: Array<{ name: string }> };
  const prompt = (await client.request("prompts/get", { name: "compare_topic", arguments: { topic: "fitness" } })) as {
    messages: Array<{ role: string; content: { text: string } }>;
  };

  assert.deepEqual(listed.prompts.map((listedPrompt) => listedPrompt.name), ["compare_topic"]);
  assert.equal(prompt.messages[0]!.role, "user");
  assert.match(prompt.messages[0]!.content.text, /get_overviews tool \(topic: "fitness"\)/);
  await testApp.close();
});

test("a notification is accepted with no body", async () => {
  const testApp = await createTestApp();
  const client = await connectMcpClient(testApp, await plusAccount(testApp));

  const response = await client.post({ jsonrpc: "2.0", method: "notifications/initialized" });

  assert.equal(response.statusCode, 202);
  assert.equal(response.body, "");
  await testApp.close();
});

test("ping answers, and a method this server does not have is a JSON-RPC error", async () => {
  const testApp = await createTestApp();
  const client = await connectMcpClient(testApp, await plusAccount(testApp));

  assert.deepEqual(await client.request("ping"), {});
  const response = await client.post({ jsonrpc: "2.0", id: 9, method: "resources/list" });
  assert.equal(response.json().error.code, -32601);
  await testApp.close();
});

test("an unknown tool is a JSON-RPC error, while arguments that do not fit are a failed call the assistant can read", async () => {
  const testApp = await createTestApp();
  const client = await connectMcpClient(testApp, await plusAccount(testApp));

  const unknown = await client.post({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "delete_everything" } });
  const badArguments = await client.callTool("search_overviews", { savedFrom: "last tuesday" });

  assert.equal(unknown.json().error.code, -32602);
  assert.equal(badArguments.isError, true);
  assert.match(badArguments.text, /savedFrom/);
  await testApp.close();
});

test("a body that is not JSON-RPC, or a batch, is refused as an invalid request", async () => {
  const testApp = await createTestApp();
  const client = await connectMcpClient(testApp, await plusAccount(testApp));

  const notRpc = await client.post({ hello: "there" });
  const batch = await client.post([INITIALIZE]);

  assert.equal(notRpc.json().error.code, -32600);
  assert.equal(batch.json().error.code, -32600);
  await testApp.close();
});

test("GET is refused, because this server opens no stream", async () => {
  const testApp = await createTestApp();
  const client = await connectMcpClient(testApp, await plusAccount(testApp));

  const response = await testApp.app.inject({
    method: "GET",
    url: "/mcp",
    headers: { authorization: `Bearer ${client.tokens.access_token}`, accept: "text/event-stream" },
  });

  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.allow, "POST");
  await testApp.close();
});

test("a protocol version header this server does not speak is refused", async () => {
  const testApp = await createTestApp();
  const client = await connectMcpClient(testApp, await plusAccount(testApp));

  const response = await client.post({ jsonrpc: "2.0", id: 1, method: "ping" }, { "mcp-protocol-version": "1999-01-01" });

  assert.equal(response.statusCode, 400);
  await testApp.close();
});

test("a request from another site's page is refused, so a browser cannot be turned against the reader", async () => {
  const testApp = await createTestApp();
  const client = await connectMcpClient(testApp, await plusAccount(testApp));

  const foreign = await client.post({ jsonrpc: "2.0", id: 1, method: "ping" }, { origin: "https://elsewhere.test" });
  const own = await client.post({ jsonrpc: "2.0", id: 1, method: "ping" }, { origin: TEST_APP_URL });

  assert.equal(foreign.statusCode, 403);
  assert.equal(own.statusCode, 200);
  await testApp.close();
});

test("one reader's connection never reads another reader's overviews", async () => {
  const testApp = await createTestApp();
  const reader = await plusAccount(testApp);
  const other = await makeAccount(testApp);
  const theirs = storedOverview({ inOneLine: "Someone else's saved video." });
  await other.inject({ method: "POST", url: "/api/overviews", body: theirs });
  const client = await connectMcpClient(testApp, reader);

  const read = await client.callTool("get_overview", { id: theirs.id });
  const many = await client.callTool("get_overviews", { ids: [theirs.id] });
  const listed = await client.callTool("search_overviews");

  assert.equal(read.isError, true);
  assert.doesNotMatch(many.text, /Someone else's/);
  assert.match(many.text, /Not in this library/);
  assert.equal(listed.text, "No saved overviews match.");
  await testApp.close();
});

test("a reader who leaves Plus cuts the assistant off on its next request", async () => {
  const testApp = await createTestApp();
  const reader = await plusAccount(testApp);
  const client = await connectMcpClient(testApp, reader);
  await client.request("ping");

  await putOnPlan(testApp, reader, "free");
  const response = await client.post({ jsonrpc: "2.0", id: 1, method: "ping" });

  assert.equal(response.statusCode, 401);
  await testApp.close();
});

test("a connection the reader revokes reads nothing on its next request", async () => {
  const testApp = await createTestApp();
  const reader = await plusAccount(testApp);
  const client = await connectMcpClient(testApp, reader);
  const [connection] = (await reader.inject({ method: "GET", url: "/api/connections" })).json().connections;

  await reader.inject({ method: "DELETE", url: `/api/connections/${connection.id}` });
  const response = await client.post({ jsonrpc: "2.0", id: 1, method: "ping" });

  assert.equal(response.statusCode, 401);
  await testApp.close();
});

test("an access token stops working once it expires", async () => {
  const testApp = await createTestApp();
  const client = await connectMcpClient(testApp, await plusAccount(testApp));

  testApp.clock.advance(ACCESS_TOKEN_TTL_MS + 1);
  const response = await client.post({ jsonrpc: "2.0", id: 1, method: "ping" });

  assert.equal(response.statusCode, 401);
  await testApp.close();
});

test("one account's assistants are limited together, and told how long to wait", async () => {
  const testApp = await createTestApp();
  const client = await connectMcpClient(testApp, await plusAccount(testApp));

  for (let sent = 0; sent < rateLimits.mcpPerAccount.limit; sent += 1) {
    await client.post({ jsonrpc: "2.0", id: sent, method: "ping" });
  }
  const response = await client.post({ jsonrpc: "2.0", id: 0, method: "ping" });

  assert.equal(response.statusCode, 429);
  assert.ok(Number(response.headers["retry-after"]) > 0);
  await testApp.close();
});

test("each tool call is counted under the reader's account: which tool, which assistant, how it went, never what was asked", async () => {
  const testApp = await createTestApp();
  const reader = await plusAccount(testApp);
  const saved = storedOverview({ inOneLine: "A video the reader saved." });
  await reader.inject({ method: "POST", url: "/api/overviews", body: saved });
  const client = await connectMcpClient(testApp, reader);

  await client.callTool("get_overviews", { ids: [saved.id] });
  await client.callTool("search_overviews", { savedFrom: "last tuesday" });

  const counted = testApp.eventSink.captured;
  assert.deepEqual(
    counted.map(({ events: [event], source }) => ({ name: event!.name, props: { ...event!.props, durationMs: 0 }, source })),
    [
      {
        name: "mcp.tools.called",
        props: { tool: "get_overviews", assistant: "claude", failed: false, overviews: 1, durationMs: 0 },
        source: { accountId: reader.accountId, origin: { kind: "mcp" }, geoAddress: null },
      },
      {
        name: "mcp.tools.called",
        props: { tool: "search_overviews", assistant: "claude", failed: true, overviews: 0, durationMs: 0 },
        source: { accountId: reader.accountId, origin: { kind: "mcp" }, geoAddress: null },
      },
    ],
  );
  assert.ok(counted.every(({ events: [event] }) => typeof event!.props.durationMs === "number"));
  await testApp.close();
});
