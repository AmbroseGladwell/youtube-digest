import test from "node:test";
import assert from "node:assert/strict";
import { VideoId } from "@overview/domain";
import { AccountCostsRepository } from "../costs/AccountCostsRepository.js";
import { recordingLogger } from "../logs/recordingLogger.testHelper.js";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { makeFakeYouTube } from "./FakeYouTube.testHelper.js";
import { QuotaSpentError, ServiceTranscripts, serviceTranscriptQuotas } from "./ServiceTranscripts.js";
import { ServiceUsageRepository } from "./ServiceUsageRepository.js";

const videoIdNumbered = (n: number) => VideoId.parse(`vid${String(n).padStart(8, "0")}`);

const serviceFor = async () => {
  const testApp = await createTestApp();
  const service = new ServiceTranscripts({
    fetches: makeFakeYouTube().fetches,
    usage: new ServiceUsageRepository(testApp.sql),
    costs: new AccountCostsRepository(testApp.sql),
    proxyDailyFetches: 1000,
    clock: () => testApp.clock.now,
  });
  return { testApp, service };
};

test("a signed-out address has a small daily safety cap, and is told when it can ask again", async () => {
  const { testApp, service } = await serviceFor();
  const { logger } = recordingLogger();
  for (let n = 1; n <= serviceTranscriptQuotas.address; n += 1) {
    await service.resolve(videoIdNumbered(n), { address: "203.0.113.7" }, logger);
  }

  const refused = await service.resolve(videoIdNumbered(99), { address: "203.0.113.7" }, logger).catch((error: unknown) => error);

  assert.equal(serviceTranscriptQuotas.address, 5);
  assert.ok(refused instanceof QuotaSpentError);
  assert.equal(refused.retryAfterSeconds, 15 * 60 * 60);
  await testApp.close();
});

test("a signed-out caller's cap line names the address counter, never the address", async () => {
  const { testApp, service } = await serviceFor();
  const { lines, logger } = recordingLogger();
  for (let n = 1; n <= serviceTranscriptQuotas.address + 1; n += 1) {
    await service.resolve(videoIdNumbered(n), { address: "203.0.113.77" }, logger).catch(() => null);
  }

  const [spent] = lines.filter((line) => line.msg === "service transcript quota spent");

  assert.deepEqual(
    { caller: spent!.caller, plan: spent!.plan, limit: spent!.limit, used: spent!.used },
    { caller: "address", plan: null, limit: 5, used: 5 },
  );
  assert.doesNotMatch(JSON.stringify(spent), /203\.0\.113\.77/);
  await testApp.close();
});
