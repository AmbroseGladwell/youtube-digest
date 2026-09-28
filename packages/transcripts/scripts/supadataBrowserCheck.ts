import http from "node:http";
import type { AddressInfo } from "node:net";
import { chromium, webkit, type BrowserType } from "playwright";
import { SUPADATA_BASE_URL, supadataRequestHeaders } from "@overview/transcripts";

// What no fixture can prove: the app's request clears Supadata's real CORS preflight in
// each engine (docs/features/transcript-retrieval.md, "The Supadata rung sends one header").
const engines: Array<[string, BrowserType]> = [
  ["webkit (every iOS browser, Safari)", webkit],
  ["chromium (Chrome, Edge, Android)", chromium],
];

const page = http.createServer((_, response) => {
  response.setHeader("content-type", "text/html");
  response.end("<!doctype html><title>supadata browser check</title>");
});
await new Promise<void>((resolve) => page.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${(page.address() as AddressInfo).port}/`;

interface Probe {
  url: string;
  headers: Record<string, string>;
}

const probe = async ({ url, headers }: Probe): Promise<string> => {
  try {
    const response = await fetch(url, { method: "GET", headers });
    return `reached Supadata, HTTP ${response.status}`;
  } catch (error) {
    return `BLOCKED before leaving the browser: ${error instanceof Error ? error.message : String(error)}`;
  }
};

const request: Probe = {
  url: `${SUPADATA_BASE_URL}/metadata?url=${encodeURIComponent("https://www.youtube.com/watch?v=dQw4w9WgXcQ")}`,
  headers: supadataRequestHeaders("not-a-real-key"),
};

let blocked = 0;
for (const [name, engine] of engines) {
  const browser = await engine.launch();
  const tab = await browser.newPage();
  tab.on("console", (message) => console.error(`    ${name}: ${message.text()}`));
  await tab.goto(origin);
  const outcome = await tab.evaluate(probe, request);
  console.log(`${outcome.startsWith("reached") ? "ok  " : "FAIL"}  ${name}: ${outcome}`);
  if (!outcome.startsWith("reached")) blocked += 1;
  await browser.close();
}
page.close();
process.exit(blocked === 0 ? 0 : 2);
