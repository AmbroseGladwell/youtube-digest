import test from "node:test";
import assert from "node:assert/strict";
import { makeOverview } from "@overview/store-conformance";
import { LOG_LEVELS, recordingLogger, type LogLine } from "../logs/recordingLogger.testHelper.js";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount } from "../testing/TestAccount.testHelper.js";

const TITLE = "A title only this note has";

const saying = (lines: LogLine[], msg: string) => lines.filter((line) => line.msg === msg);

test("a link made, opened, stopped and opened again is logged at each step, never with its token or its note", async () => {
  const { lines, logger } = recordingLogger();
  const testApp = await createTestApp({}, { logger });
  const account = await makeAccount(testApp);
  const overview = makeOverview({ video: { ...makeOverview().video, title: TITLE } });

  const { token } = (await account.inject({ method: "POST", url: "/api/shares", body: { overview } })).json();
  await testApp.app.inject({ method: "GET", url: `/s/${token}` });
  await account.inject({ method: "DELETE", url: `/api/shares/${token}` });
  await testApp.app.inject({ method: "GET", url: `/s/${token}` });
  await testApp.app.inject({ method: "GET", url: "/s/nevermadeanylinklikethis000000" });

  const [created] = saying(lines, "share created");
  assert.deepEqual(
    { level: created!.level, replacing: created!.replacing, accountId: created!.accountId },
    { level: LOG_LEVELS.info, replacing: false, accountId: account.accountId },
  );
  assert.equal(saying(lines, "share viewed").length, 1);
  assert.equal(saying(lines, "share revoked")[0]!.accountId, account.accountId);
  assert.deepEqual(saying(lines, "share page missing").map(({ state }) => state), ["revoked", "unknown"]);
  const logged = JSON.stringify(lines);
  assert.doesNotMatch(logged, new RegExp(token));
  assert.doesNotMatch(logged, new RegExp(TITLE));
  await testApp.close();
});
