import test from "node:test";
import assert from "node:assert/strict";
import {
  BEFORE_BILLING_PERIOD,
  cloudflareCostRowsOf,
  cloudflareSpend,
  cloudflareUsageRowsOf,
  environmentOfBucket,
} from "./cloudflareSpend.mjs";

const charge = (date, serviceName, serviceFamily, billedCost, consumedQuantity) => ({
  ServiceProviderName: "Cloudflare, Inc.",
  InvoiceIssuerName: "Cloudflare, Inc.",
  HostProviderName: "Cloudflare, Inc.",
  BillingAccountId: "acct",
  BillingAccountName: "Example account",
  ServiceName: serviceName,
  ServiceFamilyName: serviceFamily,
  ChargeCategory: "Usage",
  ChargeClass: null,
  ChargeDescription: `${serviceName} usage`,
  ChargePeriodStart: `${date}T00:00:00Z`,
  ChargePeriodEnd: `${date}T23:59:59Z`,
  BillingPeriodStart: "2026-10-30T00:00:00Z",
  BillingCurrency: "USD",
  ConsumedUnit: "GB-months",
  ConsumedQuantity: consumedQuantity,
  PricingQuantity: 0,
  PricingUnit: "GB-months",
  CumulatedPricingQuantity: 0,
  ListCost: billedCost,
  ContractedCost: billedCost,
  EffectiveCost: billedCost,
  BilledCost: billedCost,
  CumulatedContractedCost: 0,
  SubscriptionId: "sub",
});

const usage = [
  charge("2026-10-30", "R2 Data Storage (First 10GB-Month included)", "R2", 0, 0.002),
  charge("2026-11-07", "R2 Data Storage (First 10GB-Month included)", "R2", 0, 0.002),
  charge("2026-11-07", "R2 Storage Class A Operations (First 1M included)", "R2", 0.25, 30),
  charge("2026-11-07", "Workers Paid", "Workers", 0.15, 1),
];

const storage = [
  {
    dimensions: { bucketName: "the-overview-audio", date: "2026-11-07" },
    max: { metadataSize: 4144, objectCount: 148, payloadSize: 106_800_926 },
  },
  { dimensions: { bucketName: "the-overview-spend", date: "2026-11-07" }, max: { metadataSize: 0, objectCount: 40, payloadSize: 199_074 } },
  { dimensions: { bucketName: "the-overview-audio-dev", date: "2026-11-07" }, max: { metadataSize: 28, objectCount: 1, payloadSize: 38 } },
];

const operations = [
  { dimensions: { actionType: "GetObject", bucketName: "the-overview-audio", date: "2026-11-07" }, sum: { requests: 17 } },
  { dimensions: { actionType: "PutObject", bucketName: "the-overview-audio", date: "2026-11-07" }, sum: { requests: 8 } },
  { dimensions: { actionType: "GetObject", bucketName: "the-overview-audio-dev", date: "2026-11-07" }, sum: { requests: 2 } },
];

const find = (rows, environment, area, unit) =>
  rows.find((row) => row.environment === environment && row.area === area && row.unit === unit);

test("a bucket whose name ends in -dev is dev, every other bucket is prod", () => {
  assert.equal(environmentOfBucket("the-overview-audio-dev"), "dev");
  assert.equal(environmentOfBucket("the-overview-audio"), "prod");
  assert.equal(environmentOfBucket("the-overview-spend"), "prod");
});

test("each day's bill adds up by service family, account-wide and so unsplit, with R2 as storage", () => {
  const { rows, earliest } = cloudflareCostRowsOf({ dates: ["2026-11-07"], usage });
  assert.equal(earliest, "2026-10-30");
  assert.equal(find(rows, "unsplit", "storage").dollars, 0.25);
  assert.equal(find(rows, "unsplit", "workers").dollars, 0.15);
  assert.ok(rows.every((row) => row.provider === "cloudflare" && row.source === "bill" && row.date === "2026-11-07"));
});

test("R2 storage and requests add up per environment as usage, with no dollars", () => {
  const rows = cloudflareUsageRowsOf({ dates: ["2026-11-07"], storage, operations });
  assert.equal(find(rows, "prod", "storage", "storage_gb").quantity, (106_800_926 + 4144 + 199_074) / 1e9);
  assert.equal(find(rows, "dev", "storage", "storage_gb").quantity, 66 / 1e9);
  assert.equal(find(rows, "prod", "storage", "r2_requests").quantity, 25);
  assert.equal(find(rows, "dev", "storage", "r2_requests").quantity, 2);
  assert.ok(rows.every((row) => row.source === "usage" && row.dollars === null));
});

function fakeCloudflare({ status = 200, errors = [], billable = usage } = {}) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({
      url,
      method: init.method ?? "GET",
      authorization: init.headers.Authorization,
      body: init.body ? JSON.parse(init.body) : null,
    });
    if (status !== 200) return { ok: false, status };
    return {
      ok: true,
      json: async () =>
        url.endsWith("/graphql")
          ? {
              data: { viewer: { accounts: [{ r2StorageAdaptiveGroups: storage, r2OperationsAdaptiveGroups: operations }] } },
              errors: errors.length ? errors : null,
            }
          : { result: billable, success: true, errors: [], messages: [] },
    };
  };
  return { fetch, calls };
}

test("the bill and R2 analytics are read with the token, and only days in the billing period are readable", async () => {
  const cloudflare = fakeCloudflare();
  const { rows, readable, outOfRange } = await cloudflareSpend({
    apiToken: "token",
    accountId: "acct",
    fetch: cloudflare.fetch,
    dates: ["2026-11-06", "2026-11-07"],
  });
  assert.equal(find(rows, "unsplit", "storage").dollars, 0.25);
  assert.equal(find(rows, "prod", "storage", "r2_requests").quantity, 25);
  assert.equal(readable("2026-10-29"), false);
  assert.equal(readable("2026-10-30"), true);
  assert.equal(outOfRange, BEFORE_BILLING_PERIOD);
  const graphql = cloudflare.calls.find((call) => call.url.endsWith("/graphql"));
  assert.deepEqual(graphql.body.variables, { account: "acct", start: "2026-11-06", end: "2026-11-07" });
  assert.ok(cloudflare.calls.some((call) => call.url === "https://api.cloudflare.com/client/v4/accounts/acct/billable-usage"));
  assert.ok(cloudflare.calls.every((call) => call.authorization === "Bearer token"));
});

test("an empty bill makes no day readable, so stored figures are kept", async () => {
  const { readable } = await cloudflareSpend({
    apiToken: "t",
    accountId: "acct",
    fetch: fakeCloudflare({ billable: [] }).fetch,
    dates: ["2026-11-07"],
  });
  assert.equal(readable("2026-11-07"), false);
});

test("a refusal, or an error inside a 200, says only the status or code", async () => {
  await assert.rejects(
    cloudflareSpend({ apiToken: "t", accountId: "a", fetch: fakeCloudflare({ status: 403 }).fetch, dates: ["2026-11-07"] }),
    {
      message: "Cloudflare answered 403",
    },
  );
  await assert.rejects(
    cloudflareSpend({
      apiToken: "t",
      accountId: "a",
      fetch: fakeCloudflare({ errors: [{ code: 10000, message: "Authentication error" }] }).fetch,
      dates: ["2026-11-07"],
    }),
    { message: "Cloudflare answered with an error: 10000" },
  );
});

test("a range longer than R2 analytics allows is read in chunks of at most 31 days", async () => {
  const cloudflare = fakeCloudflare();
  const dates = Array.from({ length: 40 }, (_, index) => new Date(Date.UTC(2026, 8, 27 + index)).toISOString().slice(0, 10));
  await cloudflareSpend({ apiToken: "t", accountId: "acct", fetch: cloudflare.fetch, dates });
  assert.deepEqual(
    cloudflare.calls.filter((call) => call.url.endsWith("/graphql")).map((call) => [call.body.variables.start, call.body.variables.end]),
    [
      ["2026-09-27", "2026-10-27"],
      ["2026-10-28", "2026-11-05"],
    ],
  );
});

test("an analytics error names the code Cloudflare puts under extensions", async () => {
  const errors = [{ message: "cannot request a time range wider than 4w4d", extensions: { code: "quota" } }];
  await assert.rejects(cloudflareSpend({ apiToken: "t", accountId: "a", fetch: fakeCloudflare({ errors }).fetch, dates: ["2026-11-07"] }), {
    message: "Cloudflare answered with an error: quota",
  });
});
