import test from "node:test";
import assert from "node:assert/strict";
import { SupadataError } from "@supadata/js";
import { createSupadataClient, supadataRequestHeaders } from "./createSupadataClient.js";

interface RecordedRequest {
  url: string;
  method: string | undefined;
  headers: Record<string, string>;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function recordingFetch(respond: (request: RecordedRequest) => Response) {
  const requests: RecordedRequest[] = [];
  const fetchImpl: typeof globalThis.fetch = (input, init) => {
    const request: RecordedRequest = {
      url: String(input),
      method: init?.method,
      headers: { ...(init?.headers as Record<string, string>) },
    };
    requests.push(request);
    return Promise.resolve(respond(request));
  };
  return { requests, fetchImpl };
}

test("a request carries the api key and nothing else, so a CORS preflight has nothing to refuse", async () => {
  const { requests, fetchImpl } = recordingFetch(() => jsonResponse({ id: "abc" }));
  const client = createSupadataClient({ apiKey: "the-key", fetch: fetchImpl });

  await client.metadata({ url: "https://youtube.com/watch?v=abc" });

  assert.deepEqual(requests[0]?.headers, { "x-api-key": "the-key" });
  assert.deepEqual(supadataRequestHeaders("the-key"), { "x-api-key": "the-key" });
  assert.equal(requests[0]?.method, "GET");
});

test("metadata is a GET against /metadata with the url as a query parameter", async () => {
  const { requests, fetchImpl } = recordingFetch(() => jsonResponse({ id: "abc" }));
  const client = createSupadataClient({ apiKey: "the-key", fetch: fetchImpl });

  const metadata = await client.metadata({ url: "https://youtube.com/watch?v=abc" });

  assert.equal(
    requests[0]?.url,
    "https://api.supadata.ai/v1/metadata?url=https%3A%2F%2Fyoutube.com%2Fwatch%3Fv%3Dabc",
  );
  assert.deepEqual(metadata, { id: "abc" });
});

test("transcript params are serialised the way the SDK serialised them, and absent ones are left out", async () => {
  const { requests, fetchImpl } = recordingFetch(() => jsonResponse({ content: [], lang: "en", availableLangs: [] }));
  const client = createSupadataClient({ apiKey: "the-key", fetch: fetchImpl });

  await client.transcript({ url: "https://youtube.com/watch?v=abc", text: false, mode: "native" });
  await client.transcript({ url: "https://youtube.com/watch?v=abc", text: false, mode: "generate", lang: "de" });

  const first = new URL(requests[0]!.url);
  assert.equal(first.pathname, "/v1/transcript");
  assert.deepEqual(Object.fromEntries(first.searchParams), {
    url: "https://youtube.com/watch?v=abc",
    text: "false",
    mode: "native",
  });
  assert.equal(new URL(requests[1]!.url).searchParams.get("lang"), "de");
});

test("a job's status is read from /transcript/<jobId>", async () => {
  const { requests, fetchImpl } = recordingFetch(() => jsonResponse({ status: "queued" }));
  const client = createSupadataClient({ apiKey: "the-key", fetch: fetchImpl });

  const job = await client.transcript.getJobStatus("job/1");

  assert.equal(requests[0]?.url, "https://api.supadata.ai/v1/transcript/job%2F1");
  assert.equal(job.status, "queued");
});

test("the base url can be pointed elsewhere", async () => {
  const { requests, fetchImpl } = recordingFetch(() => jsonResponse({}));
  const client = createSupadataClient({ apiKey: "k", baseUrl: "http://localhost:9999/v1", fetch: fetchImpl });

  await client.metadata({ url: "u" });

  assert.equal(requests[0]?.url, "http://localhost:9999/v1/metadata?url=u");
});

test("an error body becomes a SupadataError carrying the provider's code, as the SDK's did", async () => {
  const { fetchImpl } = recordingFetch(() =>
    jsonResponse({ error: "transcript-unavailable", message: "No transcript", details: "none" }, 404),
  );
  const client = createSupadataClient({ apiKey: "k", fetch: fetchImpl });

  await assert.rejects(
    () => client.transcript({ url: "u" }),
    (error: unknown) =>
      error instanceof SupadataError && error.error === "transcript-unavailable" && error.message === "No transcript",
  );
});

test("a non-JSON failure is an internal error rather than a parse crash", async () => {
  const { fetchImpl } = recordingFetch(
    () => new Response("<html>bad gateway</html>", { status: 502, headers: { "content-type": "text/html" } }),
  );
  const client = createSupadataClient({ apiKey: "k", fetch: fetchImpl });

  await assert.rejects(
    () => client.metadata({ url: "u" }),
    (error: unknown) => error instanceof SupadataError && error.error === "internal-error" && error.details.includes("bad gateway"),
  );
});

test("a successful status with a non-JSON body is also refused", async () => {
  const { fetchImpl } = recordingFetch(
    () => new Response("ok", { status: 200, headers: { "content-type": "text/plain" } }),
  );
  const client = createSupadataClient({ apiKey: "k", fetch: fetchImpl });

  await assert.rejects(
    () => client.metadata({ url: "u" }),
    (error: unknown) => error instanceof SupadataError && error.error === "internal-error",
  );
});
