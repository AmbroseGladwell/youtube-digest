const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class ManualEntriesError extends Error {}

export function parseManualEntries(json) {
  if (json === undefined || json.trim() === "") return [];
  let entries;
  try {
    entries = JSON.parse(json);
  } catch {
    throw new ManualEntriesError("SPEND_MANUAL_ENTRIES is not JSON");
  }
  if (!Array.isArray(entries)) throw new ManualEntriesError("SPEND_MANUAL_ENTRIES is not a list");
  return entries.map((entry, index) => {
    const { provider, environment, area, monthlyDollars, from, to = null } = entry ?? {};
    const valid =
      [provider, environment, area].every((field) => typeof field === "string" && field.length > 0) &&
      typeof monthlyDollars === "number" &&
      monthlyDollars >= 0 &&
      typeof from === "string" &&
      DAY.test(from) &&
      (to === null || (typeof to === "string" && DAY.test(to)));
    if (!valid)
      throw new ManualEntriesError(`SPEND_MANUAL_ENTRIES entry ${index} needs provider, environment, area, monthlyDollars and from`);
    return { provider, environment, area, monthlyDollars, from, to };
  });
}

function daysInMonthOf(date) {
  const [year, month] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function manualRowsFor(entries, date) {
  return entries
    .filter((entry) => entry.from <= date && (entry.to === null || date <= entry.to))
    .map(({ provider, environment, area, monthlyDollars }) => ({
      date,
      provider,
      environment,
      area,
      dollars: monthlyDollars / daysInMonthOf(date),
      source: "manual",
    }));
}
