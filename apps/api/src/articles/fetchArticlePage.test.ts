import test, { after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createArticlePageFetcher } from "./fetchArticlePage.js";
import { isPublicAddress } from "./isPublicAddress.js";

const ARTICLE = "<html><head><title>A</title></head><body><p>Hello</p></body></html>";
let seen: { path: string | undefined; cookie: string | undefined }[] = [];

const server = http.createServer((request, response) => {
  seen.push({ path: request.url, cookie: request.headers.cookie });
  const send = (status: number, headers: http.OutgoingHttpHeaders, body = "") => {
    response.writeHead(status, headers);
    response.end(body);
  };
  switch (request.url) {
    case "/ok":
      return send(200, { "content-type": "text/html; charset=utf-8" }, ARTICLE);
    case "/moved":
      return send(302, { location: "/ok" });
    case "/to-metadata":
      return send(302, { location: "http://169.254.169.254/latest/meta-data/" });
    case "/to-ip-as-number":
      return send(302, { location: "http://2130706433/ok" });
    case "/loop":
      return send(302, { location: "/loop" });
    case "/blocked":
      return send(403, {});
    case "/gone":
      return send(404, {});
    case "/broken":
      return send(502, {});
    case "/pdf":
      return send(200, { "content-type": "application/pdf" }, "%PDF");
    case "/huge":
      return send(200, { "content-type": "text/html" }, "x".repeat(4096));
    default:
      return;
  }
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address() as AddressInfo;
const at = (path: string) => `http://127.0.0.1:${port}${path}`;
after(() => {
  server.closeAllConnections();
  server.close();
});

// The test's server is on loopback, so this one opens loopback and nothing else.
const fetchHere = createArticlePageFetcher({
  isAllowedAddress: (address) => address === "127.0.0.1",
  allowedPorts: [String(port)],
  timeoutMs: 400,
  mostBytes: 1024,
});
const fetchAsProduction = createArticlePageFetcher();

test("private and reserved addresses are closed, including one written as mapped IPv6", () => {
  for (const address of [
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "::",
    "fe80::1",
    "fdaa::1",
    "::ffff:127.0.0.1",
    "::ffff:169.254.169.254",
    "not an address",
  ]) {
    assert.equal(isPublicAddress(address), false, address);
  }
});

test("public addresses are open", () => {
  for (const address of ["8.8.8.8", "93.184.216.34", "2606:4700:4700::1111"]) {
    assert.equal(isPublicAddress(address), true, address);
  }
});

test("production's fetcher reaches nothing on this machine, by address, by name or by an odd spelling", async () => {
  for (const link of [at("/ok"), `http://localhost:${port}/ok`, `http://[::1]:${port}/ok`, "http://127.1/ok", "http://2130706433/ok"]) {
    seen = [];
    assert.deepEqual(await fetchAsProduction(link), { status: "failed", reason: "not-found" }, link);
    assert.equal(seen.length, 0, link);
  }
});

test("a name that resolves to a private address is refused at connection", async () => {
  const onlyTheWebPorts = createArticlePageFetcher({ allowedPorts: [String(port)] });
  seen = [];
  assert.deepEqual(await onlyTheWebPorts(`http://localhost:${port}/ok`), { status: "failed", reason: "not-found" });
  assert.equal(seen.length, 0);
});

test("anything but a web address on a web port is refused", async () => {
  for (const link of ["file:///etc/passwd", "ftp://example.com/a", "http://example.com:6379/", "http://user:pass@example.com/"]) {
    assert.deepEqual(await fetchAsProduction(link), { status: "failed", reason: "not-found" }, link);
  }
});

test("a page comes back with the address it ended at", async () => {
  assert.deepEqual(await fetchHere(at("/moved")), { status: "page", url: at("/ok"), html: ARTICLE });
});

test("a redirect is checked as if it had been pasted, so it can't lead inside", async () => {
  assert.deepEqual(await fetchHere(at("/to-metadata")), { status: "failed", reason: "not-found" });
  assert.deepEqual(await fetchHere(at("/to-ip-as-number")), { status: "failed", reason: "not-found" });
});

test("what a site answers becomes a reason the reader can be told", async () => {
  const reasons = await Promise.all(
    ["/blocked", "/gone", "/broken", "/pdf", "/huge", "/loop", "/silent"].map((path) => fetchHere(at(path))),
  );
  assert.deepEqual(
    reasons.map((read) => (read.status === "failed" ? read.reason : read.status)),
    ["blocked", "not-found", "no-answer", "nothing-readable", "nothing-readable", "no-answer", "no-answer"],
  );
});

test("no cookie travels with a reader's link", async () => {
  seen = [];
  await fetchHere(at("/ok"));
  assert.equal(seen[0]?.cookie, undefined);
});
