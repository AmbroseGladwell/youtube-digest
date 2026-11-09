import { ProviderReadError } from "./ProviderReadError.mjs";

const CLOUDFLARE_API = "https://api.cloudflare.com/client/v4";
const GB = 1e9;
const ANALYTICS_DAYS = 31;

export const BEFORE_BILLING_PERIOD = "Cloudflare's billable usage covers only the current billing period";

const R2_USAGE = `query R2Usage($account: String!, $start: Date!, $end: Date!) {
  viewer { accounts(filter: { accountTag: $account }) {
    r2StorageAdaptiveGroups(limit: 10000, filter: { date_geq: $start, date_leq: $end }) {
      max { payloadSize metadataSize }
      dimensions { date bucketName }
    }
    r2OperationsAdaptiveGroups(limit: 10000, filter: { date_geq: $start, date_leq: $end }) {
      sum { requests }
      dimensions { date bucketName }
    }
  } }
}`;

export const environmentOfBucket = (bucketName) => (bucketName.endsWith("-dev") ? "dev" : "prod");

const areaOfService = (serviceFamily) => (serviceFamily === "R2" ? "storage" : serviceFamily.toLowerCase().replace(/[^a-z0-9]+/g, "_"));

export function cloudflareCostRowsOf({ dates, usage }) {
  const wanted = new Set(dates);
  const totals = new Map();
  for (const charge of usage) {
    const date = charge.ChargePeriodStart.slice(0, 10);
    if (!wanted.has(date)) continue;
    const area = areaOfService(charge.ServiceFamilyName);
    const key = `${date}|${area}`;
    const total = totals.get(key) ?? { date, provider: "cloudflare", environment: "unsplit", area, dollars: 0, source: "bill" };
    total.dollars += Number(charge.BilledCost);
    totals.set(key, total);
  }
  const earliest = usage.map((charge) => charge.ChargePeriodStart.slice(0, 10)).sort()[0] ?? null;
  return { rows: [...totals.values()], earliest };
}

export function cloudflareUsageRowsOf({ dates, storage, operations }) {
  const wanted = new Set(dates);
  const totals = new Map();
  const add = (date, bucketName, unit, quantity) => {
    if (!wanted.has(date)) return;
    const environment = environmentOfBucket(bucketName);
    const key = `${date}|${environment}|${unit}`;
    const total = totals.get(key) ?? {
      date,
      provider: "cloudflare",
      environment,
      area: "storage",
      dollars: null,
      quantity: 0,
      unit,
      source: "usage",
    };
    total.quantity += quantity;
    totals.set(key, total);
  };
  for (const group of storage)
    add(group.dimensions.date, group.dimensions.bucketName, "storage_gb", (group.max.payloadSize + group.max.metadataSize) / GB);
  for (const group of operations) add(group.dimensions.date, group.dimensions.bucketName, "r2_requests", group.sum.requests);
  return [...totals.values()];
}

async function readCloudflare(fetch, url, apiToken, init = {}) {
  const response = await fetch(url, { ...init, headers: { Authorization: `Bearer ${apiToken}`, "content-type": "application/json" } });
  if (!response.ok) throw new ProviderReadError(`Cloudflare answered ${response.status}`);
  const body = await response.json();
  if (body.success === false || (Array.isArray(body.errors) && body.errors.length > 0)) {
    const [first] = body.errors ?? [];
    throw new ProviderReadError(`Cloudflare answered with an error: ${first?.code ?? first?.extensions?.code ?? "unknown"}`);
  }
  return body;
}

export async function cloudflareSpend({ apiToken, accountId, fetch, dates }) {
  const billable = await readCloudflare(fetch, `${CLOUDFLARE_API}/accounts/${accountId}/billable-usage`, apiToken);
  const storage = [];
  const operations = [];
  for (let start = 0; start < dates.length; start += ANALYTICS_DAYS) {
    const chunk = dates.slice(start, start + ANALYTICS_DAYS);
    const analytics = await readCloudflare(fetch, `${CLOUDFLARE_API}/graphql`, apiToken, {
      method: "POST",
      body: JSON.stringify({ query: R2_USAGE, variables: { account: accountId, start: chunk[0], end: chunk.at(-1) } }),
    });
    const account = analytics.data.viewer.accounts[0];
    storage.push(...(account?.r2StorageAdaptiveGroups ?? []));
    operations.push(...(account?.r2OperationsAdaptiveGroups ?? []));
  }
  const { rows: costRows, earliest } = cloudflareCostRowsOf({ dates, usage: billable.result });
  const usageRows = cloudflareUsageRowsOf({ dates, storage, operations });
  return {
    rows: [...costRows, ...usageRows],
    readable: (date) => earliest !== null && date >= earliest,
    outOfRange: BEFORE_BILLING_PERIOD,
  };
}
