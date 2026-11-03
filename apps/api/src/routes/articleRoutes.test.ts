import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_VERSION, CLIENT_VERSION_HEADER } from "@overview/domain";
import type { FetchedPage } from "../articles/fetchArticlePage.js";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount } from "../testing/TestAccount.testHelper.js";

const URL_OF_PAGE = "https://news.example.com/bridge";
const paragraphs = Array.from({ length: 30 }, (_, index) => `<p>Paragraph ${index} says the county reused an old survey, and that residents will pay for the repair twice over.</p>`).join("");
const HTML = `<!doctype html><html><head><title>The bridge</title><script>fetch("http://169.254.169.254/");document.title="ran"</script></head><body><article><h1>The bridge</h1>${paragraphs}</article></body></html>`;

const appServing = (page: FetchedPage) => createTestApp({}, { fetchArticlePage: async () => page });

test("a pasted link comes back as the article, read without running the page's scripts", async () => {
  const testApp = await appServing({ status: "page", url: URL_OF_PAGE, html: HTML });
  const account = await makeAccount(testApp);

  const response = await account.inject({ method: "POST", url: "/api/articles/read", body: { url: URL_OF_PAGE } });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().status, "read");
  assert.equal(response.json().article.title, "The bridge");
  await testApp.close();
});

test("a page that couldn't be fetched answers with why, not an error", async () => {
  const testApp = await appServing({ status: "failed", reason: "blocked" });
  const account = await makeAccount(testApp);

  const response = await account.inject({ method: "POST", url: "/api/articles/read", body: { url: URL_OF_PAGE } });

  assert.deepEqual(response.json(), { status: "failed", reason: "blocked" });
  await testApp.close();
});

test("only an account can ask our server to fetch something", async () => {
  const testApp = await appServing({ status: "failed", reason: "blocked" });

  const response = await testApp.app.inject({
    method: "POST",
    url: "/api/articles/read",
    headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) },
    payload: { url: URL_OF_PAGE },
  });

  assert.equal(response.statusCode, 401);
  await testApp.close();
});

test("something that isn't a link is refused", async () => {
  const testApp = await appServing({ status: "failed", reason: "blocked" });
  const account = await makeAccount(testApp);

  const response = await account.inject({ method: "POST", url: "/api/articles/read", body: { url: "not a link" } });

  assert.equal(response.statusCode, 400);
  await testApp.close();
});
