import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { API_LOG_LINES, CLIENT_VERSION, CLIENT_VERSION_HEADER } from "@overview/domain";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount } from "../testing/TestAccount.testHelper.js";
import { recordingLogger } from "./recordingLogger.testHelper.js";

const CODES = new Set(API_LOG_LINES.map(({ logCode }) => logCode));

test("every line the server writes carries a code from the catalogue", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await createTestApp({}, { logger });
  const account = await makeAccount(testApp);

  await testApp.app.inject({ method: "GET", url: "/api/nothing-here" });
  await testApp.app.inject({ method: "GET", url: "/s/sharetoken0123456789abcdef" });
  await account.inject({ method: "GET", url: "/api/changes?since=0" });
  await account.inject({ method: "POST", url: "/api/events", body: { events: [{ name: "not.an.event", at: new Date().toISOString() }] } });
  await testApp.app.inject({
    method: "POST",
    url: "/api/overviews",
    headers: { [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) },
    body: {},
  });

  assert.ok(lines.length > 0);
  for (const line of lines) {
    assert.ok(typeof line.logCode === "string", `"${line.msg}" has no logCode`);
    assert.ok(CODES.has(line.logCode as string), `"${line.msg}" has an unknown logCode ${String(line.logCode)}`);
  }
  await testApp.close();
});

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith(".ts") && !entry.name.includes(".test.") && !entry.name.includes("testHelper") ? [path] : [];
  });

// The runtime check above only sees the lines a test happens to reach, so the source is
// checked too: a new line without a catalogue entry fails here rather than in PostHog.
test("no log call writes a message of its own instead of a line from the catalogue", () => {
  const offenders: string[] = [];
  for (const path of sourceFiles("src")) {
    const source = readFileSync(path, "utf8");
    for (const match of source.matchAll(/\blog(?:ger)?(?:\(\))?\.(?:fatal|error|warn|info|debug)\(([\s\S]{0,160})/g)) {
      const call = (match[1] ?? "").trim();
      if (!call.includes("apiLogLines.") && !call.includes("FATAL_LINES[")) {
        offenders.push(`${path}: ${call.replace(/\s+/g, " ").slice(0, 70)}`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});
