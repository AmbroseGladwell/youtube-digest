import type { Connection } from "@overview/domain";

const HOUR_MS = 60 * 60 * 1000;

const dayKey = (date: Date, timeZone: string | undefined) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

const dayMonth = (date: Date, timeZone: string | undefined) =>
  new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "long" }).format(date);

const useText = (used: Date, now: Date, timeZone: string | undefined): string => {
  if (now.getTime() - used.getTime() < HOUR_MS) {
    return "Used in the last hour";
  }
  return dayKey(used, timeZone) === dayKey(now, timeZone) ? "Used today" : `Last used ${dayMonth(used, timeZone)}`;
};

// Nothing finer than the hour: docs/features/mcp-connector.md, "Tokens".
export const connectionUseLine = (
  { createdAt, lastUsedAt }: Pick<Connection, "createdAt" | "lastUsedAt">,
  now: Date,
  timeZone?: string,
): string => {
  const created = new Date(createdAt);
  const used = new Date(lastUsedAt);
  const use = useText(used, now, timeZone);
  return `Connected ${dayMonth(created, timeZone)} · ${use}`;
};
