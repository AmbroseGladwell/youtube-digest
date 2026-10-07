import test from "node:test";
import assert from "node:assert/strict";
import { OtlpLogExporter, type OtlpLogExporterOptions } from "./OtlpLogExporter.js";

interface Posted {
  url: string;
  headers: Record<string, string>;
  bodies: string[];
  attributes: Array<Array<{ key: string; value: unknown }>>;
  resource: Array<{ key: string; value: unknown }>;
}

const line = (msg: string, extra: object = {}) => `${JSON.stringify({ level: 30, time: 0, msg, ...extra })}\n`;

const makeExporter = (options: Partial<OtlpLogExporterOptions> = {}) => {
  const posted: Posted[] = [];
  const failures: string[] = [];
  let status = 200;
  const exporter = new OtlpLogExporter({
    endpoint: "https://logs.example/i/v1/logs",
    headers: { authorization: "Bearer phc_test" },
    resource: { "service.name": "overview-api", "deployment.environment.name": "production" },
    flushIntervalMs: 60_000,
    onFailure: (message) => void failures.push(message),
    fetch: async (input, init) => {
      if (status >= 300) return new Response(null, { status });
      const body = JSON.parse(init!.body as string);
      const [{ resource, scopeLogs }] = body.resourceLogs;
      const records = scopeLogs[0].logRecords;
      posted.push({
        url: String(input),
        headers: init!.headers as Record<string, string>,
        bodies: records.map((record: { body: { stringValue: string } }) => record.body.stringValue),
        attributes: records.map((record: { attributes: Array<{ key: string; value: unknown }> }) => record.attributes),
        resource: resource.attributes,
      });
      return new Response(null, { status });
    },
    ...options,
  });
  return { exporter, posted, failures, answer: (next: number) => (status = next) };
};

test("held lines are posted together as OTLP JSON, under the destination's headers and this service's name", async () => {
  const { exporter, posted } = makeExporter();

  exporter.write(line("incoming request", { reqId: "request-1" }));
  exporter.write(line("request completed", { reqId: "request-1" }));
  await exporter.flush();

  assert.equal(posted.length, 1);
  assert.equal(posted[0]!.url, "https://logs.example/i/v1/logs");
  assert.equal(posted[0]!.headers.authorization, "Bearer phc_test");
  assert.equal(posted[0]!.headers["content-type"], "application/json");
  assert.deepEqual(posted[0]!.bodies, ["incoming request", "request completed"]);
  assert.deepEqual(posted[0]!.resource, [
    { key: "service.name", value: { stringValue: "overview-api" } },
    { key: "deployment.environment.name", value: { stringValue: "production" } },
  ]);
});

test("a full batch is sent without waiting for the interval", async () => {
  const { exporter, posted } = makeExporter({ maxBatchRecords: 2 });

  exporter.write(line("one") + line("two") + line("three"));
  await exporter.flush();

  assert.deepEqual(posted.map(({ bodies }) => bodies), [["one", "two"], ["three"]]);
});

test("a batch the destination refused is dropped, not retried, and the next batch says how many were lost", async () => {
  const { exporter, posted, failures, answer } = makeExporter();

  answer(503);
  exporter.write(line("lost one") + line("lost two"));
  await exporter.flush();
  answer(200);
  exporter.write(line("arrived"));
  await exporter.flush();

  assert.deepEqual(failures, ["Error: the log destination answered 503"]);
  assert.deepEqual(posted.map(({ bodies }) => bodies), [["log records dropped", "arrived"]]);
  assert.deepEqual(posted[0]!.attributes[0], [
    { key: "logCode", value: { stringValue: "api.logs.recordsDropped" } },
    { key: "service", value: { stringValue: "overview-api" } },
    { key: "dropped", value: { intValue: "2" } },
  ]);
});

test("past what it may hold, lines are dropped and counted rather than held without limit", async () => {
  const { exporter, posted, answer } = makeExporter({ maxHeldRecords: 2, maxBatchRecords: 10 });

  answer(503);
  exporter.write(line("a") + line("b") + line("c"));
  answer(200);
  await exporter.flush();

  assert.deepEqual(posted.map(({ bodies }) => bodies), [["log records dropped", "a", "b"]]);
  assert.deepEqual(posted[0]!.attributes[0], [
    { key: "logCode", value: { stringValue: "api.logs.recordsDropped" } },
    { key: "service", value: { stringValue: "overview-api" } },
    { key: "dropped", value: { intValue: "1" } },
  ]);
});

test("closing ships what is still held", async () => {
  const { exporter, posted } = makeExporter();

  exporter.write(line("shutting down"));
  await exporter.close();

  assert.deepEqual(posted.map(({ bodies }) => bodies), [["shutting down"]]);
});

test("a line that isn't JSON is skipped rather than breaking the batch", async () => {
  const { exporter, posted } = makeExporter();

  exporter.write("not json\n" + line("kept"));
  await exporter.flush();

  assert.deepEqual(posted.map(({ bodies }) => bodies), [["kept"]]);
});
