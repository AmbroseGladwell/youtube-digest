import { fileURLToPath } from "node:url";
import { cloudflareSpend } from "./cloudflareSpend.mjs";
import { decodoUsage } from "./decodoUsage.mjs";
import { ENTERED_BY_HAND, EXPECTED_SPEND, spendKey } from "./expectedSpend.mjs";
import { manualRowsFor, parseManualEntries } from "./manualSpend.mjs";
import { neonUsage } from "./neonUsage.mjs";
import { openAiSpend } from "./openAiSpend.mjs";
import { r2SpendStore } from "./r2SpendStore.mjs";
import { parseSpendCsv, spendCsv } from "./spendCsv.mjs";

const DAY_MS = 86_400_000;
const NIGHTLY_DAYS = 3;
const MAX_DAYS = 180;

export const NOT_BUILT = "not built yet";
export const NO_FIGURE = "the bill has no figure for this day yet";
export const NEON_YESTERDAY_ONLY = "Neon reports only the month so far, as of the latest run";

export function datesBetween(from, to) {
  const dates = [];
  for (let time = Date.parse(`${from}T00:00:00Z`); time <= Date.parse(`${to}T00:00:00Z`); time += DAY_MS) {
    dates.push(new Date(time).toISOString().slice(0, 10));
  }
  return dates;
}

export function recentDays(now, count = NIGHTLY_DAYS) {
  const today = Date.parse(now.toISOString().slice(0, 10));
  const day = (offset) => new Date(today - offset * DAY_MS).toISOString().slice(0, 10);
  return { from: day(count), to: day(1) };
}

export const spendObjectKey = (date) => `daily/${date}.csv`;

const ORDER = (left, right) =>
  left.provider.localeCompare(right.provider) ||
  left.environment.localeCompare(right.environment) ||
  left.area.localeCompare(right.area) ||
  (left.unit ?? "").localeCompare(right.unit ?? "");

export function rowsForDay({ date, billed, manualEntries, unreadable, kept = [] }) {
  const bills = billed.filter((row) => row.source === "bill");
  const read = new Set(bills.map((row) => row.provider));
  const rows = [...billed.filter((row) => row.date === date), ...kept];
  const covered = new Set(rows.filter((row) => row.source !== "usage").map(spendKey));
  const conflicts = [];
  for (const row of manualRowsFor(manualEntries, date)) {
    if (covered.has(spendKey(row))) {
      conflicts.push(spendKey(row));
      continue;
    }
    rows.push(row);
    covered.add(spendKey(row));
  }
  for (const expected of EXPECTED_SPEND.filter((spend) => !covered.has(spendKey(spend)))) {
    rows.push({
      date,
      ...expected,
      dollars: null,
      source: "not_tracked",
      reason:
        unreadable.get(expected.provider) ?? (read.has(expected.provider) ? NO_FIGURE : (ENTERED_BY_HAND[expected.provider] ?? NOT_BUILT)),
    });
  }
  return { rows: rows.sort(ORDER), conflicts };
}

export function sourcesByProvider(rows) {
  const sources = new Map();
  for (const row of rows) sources.set(row.provider, new Set([...(sources.get(row.provider) ?? []), row.source]));
  return [...sources].map(([provider, set]) => `${provider}: ${[...set].join("+").replace("not_tracked", "not tracked")}`).join(", ");
}

export async function recordSpend({ from, to, readers, manualEntries, store, recordedAt }) {
  const dates = datesBetween(from, to);
  if (dates.length === 0 || dates.length > MAX_DAYS) throw new Error(`Record between 1 and ${MAX_DAYS} days, not ${dates.length}`);
  const warnings = [];
  const unreadable = new Map();
  const readable = new Map();
  const billed = [];
  for (const [provider, reader] of Object.entries(readers)) {
    if (reader.missing !== undefined) {
      unreadable.set(provider, reader.missing);
      warnings.push(`${provider} is not tracked: ${reader.missing}`);
      continue;
    }
    try {
      const result = await reader.read({ from, to });
      const { rows, readable: canRead = () => true, outOfRange = NO_FIGURE } = Array.isArray(result) ? { rows: result } : result;
      readable.set(provider, { canRead, outOfRange });
      billed.push(...rows.filter((row) => canRead(row.date)));
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown error";
      unreadable.set(provider, reason);
      warnings.push(`${provider} could not be read for ${from} to ${to}: ${reason}`);
    }
  }
  const days = [];
  for (const date of dates) {
    const key = spendObjectKey(date);
    const unreadableToday = new Map(unreadable);
    for (const [provider, { canRead, outOfRange }] of readable) if (!canRead(date)) unreadableToday.set(provider, outOfRange);
    let kept = [];
    try {
      kept = await storedRowsOf(store, key, unreadableToday);
    } catch (error) {
      warnings.push(
        `${date}: the stored day could not be read, so nothing was kept from it: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
    const { rows, conflicts } = rowsForDay({ date, billed, manualEntries, unreadable: unreadableToday, kept });
    for (const conflict of conflicts) warnings.push(`${date}: ${conflict} has a hand-entered figure and a bill; the bill is kept`);
    const csv = spendCsv(rows, recordedAt);
    const keptFrom = [...new Set(kept.map((row) => row.provider))];
    try {
      await store.put(key, csv);
      const readBack = await store.get(key);
      days.push({ date, key, rows: rows.length, recorded: readBack === csv, sources: sourcesByProvider(rows), keptFrom });
    } catch (error) {
      days.push({ date, key, rows: rows.length, recorded: false, error: error instanceof Error ? error.message : "unknown error" });
    }
  }
  return { days, warnings };
}

const KEPT_SOURCES = new Set(["bill", "usage"]);

async function storedRowsOf(store, key, unreadableToday) {
  if (unreadableToday.size === 0) return [];
  const stored = await store.get(key);
  if (stored === null) return [];
  return parseSpendCsv(stored).filter((row) => unreadableToday.has(row.provider) && KEPT_SOURCES.has(row.source));
}

const isSet = (value) => value !== undefined && value !== "";

export function readersFromEnv(env, fetch, now) {
  const yesterday = recentDays(now, 1).to;
  return {
    openai: isSet(env.OPENAI_ADMIN_KEY)
      ? { read: ({ from, to }) => openAiSpend({ adminKey: env.OPENAI_ADMIN_KEY, fetch, from, to }) }
      : { missing: "OPENAI_ADMIN_KEY is not set" },
    neon:
      isSet(env.NEON_API_KEY) && isSet(env.NEON_PROJECT_ID)
        ? {
            read: async ({ to }) => ({
              rows: to === yesterday ? await neonUsage({ apiKey: env.NEON_API_KEY, projectId: env.NEON_PROJECT_ID, fetch, date: to }) : [],
              readable: (date) => to === yesterday && date === yesterday,
              outOfRange: NEON_YESTERDAY_ONLY,
            }),
          }
        : { missing: "NEON_API_KEY or NEON_PROJECT_ID is not set" },
    decodo: isSet(env.DECODO_API_KEY)
      ? { read: ({ from, to }) => decodoUsage({ apiKey: env.DECODO_API_KEY, fetch, dates: datesBetween(from, to) }) }
      : { missing: "DECODO_API_KEY is not set" },
    cloudflare:
      isSet(env.CLOUDFLARE_API_TOKEN) && isSet(env.R2_ACCOUNT_ID)
        ? {
            read: ({ from, to }) =>
              cloudflareSpend({ apiToken: env.CLOUDFLARE_API_TOKEN, accountId: env.R2_ACCOUNT_ID, fetch, dates: datesBetween(from, to) }),
          }
        : { missing: "CLOUDFLARE_API_TOKEN or R2_ACCOUNT_ID is not set" },
  };
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  const env = process.env;
  const missing = ["R2_ACCOUNT_ID", "SPEND_R2_BUCKET", "SPEND_R2_ACCESS_KEY_ID", "SPEND_R2_SECRET_ACCESS_KEY"].filter(
    (name) => (env[name] ?? "") === "",
  );
  if (missing.length > 0) {
    console.log(`::error::Nothing can be recorded without ${missing.join(", ")}`);
    process.exit(1);
  }
  let manualEntries = [];
  try {
    manualEntries = parseManualEntries(env.SPEND_MANUAL_ENTRIES);
  } catch (error) {
    console.log(`::warning::${error.message}, so every hand-entered figure shows as not tracked`);
  }
  const { from, to } = env.SPEND_FROM ? { from: env.SPEND_FROM, to: env.SPEND_TO || env.SPEND_FROM } : recentDays(new Date());
  const store = r2SpendStore({
    accountId: env.R2_ACCOUNT_ID,
    bucket: env.SPEND_R2_BUCKET,
    accessKeyId: env.SPEND_R2_ACCESS_KEY_ID,
    secretAccessKey: env.SPEND_R2_SECRET_ACCESS_KEY,
    fetch: globalThis.fetch,
  });
  const { days, warnings } = await recordSpend({
    from,
    to,
    readers: readersFromEnv(env, globalThis.fetch, new Date()),
    manualEntries,
    store,
    recordedAt: new Date().toISOString(),
  });
  for (const warning of warnings) console.log(`::warning::${warning}`);
  for (const day of days) {
    console.log(
      day.recorded
        ? `${day.date}: ${day.rows} rows recorded and read back (${day.sources})${day.keptFrom.length > 0 ? `, kept the stored figures of ${day.keptFrom.join(", ")}` : ""}`
        : `::error::${day.date}: not recorded: ${day.error ?? "what was read back differs from what was written"}`,
    );
  }
  process.exit(days.every((day) => day.recorded) ? 0 : 1);
}
