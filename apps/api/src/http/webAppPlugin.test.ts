import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../testing/createTestApp.testHelper.js";

async function builtWebApp(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "overview-web-"));
  await mkdir(join(root, "assets"));
  await writeFile(join(root, "index.html"), "<!doctype html><title>Overview</title>");
  await writeFile(join(root, "assets", "index-abc123.js"), "console.log('app')");
  return root;
}

test("the web app's index is served at the root and must revalidate", async () => {
  const testApp = await createTestApp({ staticRoot: await builtWebApp() });
  const response = await testApp.app.inject({ method: "GET", url: "/" });

  assert.equal(response.statusCode, 200);
  assert.match(response.headers["content-type"] as string, /text\/html/);
  assert.equal(response.headers["cache-control"], "no-cache");
  assert.match(response.body, /Overview/);
  await testApp.close();
});

test("a hashed asset is immutable for a year", async () => {
  const testApp = await createTestApp({ staticRoot: await builtWebApp() });
  const response = await testApp.app.inject({ method: "GET", url: "/assets/index-abc123.js" });

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["cache-control"], "public, max-age=31536000, immutable");
  await testApp.close();
});

test("a route the router owns, like the sign-in page, gets the index rather than a 404", async () => {
  const testApp = await createTestApp({ staticRoot: await builtWebApp() });
  const response = await testApp.app.inject({ method: "GET", url: "/sign-in" });

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /Overview/);
  assert.equal(response.headers["cache-control"], "no-cache");
  await testApp.close();
});

test("an asset a deploy has deleted is a 404, never the index in a script's clothing", async () => {
  const testApp = await createTestApp({ staticRoot: await builtWebApp() });
  const response = await testApp.app.inject({ method: "GET", url: "/assets/index-old000.js" });

  assert.equal(response.statusCode, 404);
  await testApp.close();
});

test("an unknown /api route still answers in the envelope, not with the index", async () => {
  const testApp = await createTestApp({ staticRoot: await builtWebApp() });
  const response = await testApp.app.inject({ method: "GET", url: "/api/nowhere" });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, "not_found");
  await testApp.close();
});

test("a write to a page address is a 404, since only the router's reads fall through", async () => {
  const testApp = await createTestApp({ staticRoot: await builtWebApp() });
  const response = await testApp.app.inject({ method: "POST", url: "/sign-in" });

  assert.equal(response.statusCode, 404);
  await testApp.close();
});

test("without a web app to serve, the root is plainly absent", async () => {
  const testApp = await createTestApp();
  const response = await testApp.app.inject({ method: "GET", url: "/" });

  assert.equal(response.statusCode, 404);
  await testApp.close();
});
