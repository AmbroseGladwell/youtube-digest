import type { Connection } from "@overview/domain";

const HOUR_MS = 60 * 60 * 1000;

const dayKey = (date: Date, timeZone: string | undefined) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

const dayMonth = (date: Date, timeZone: string | undefined) =>
  new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "long" }).format(date);

// The server marks a connection used at most once an hour, so nothing finer than the hour
// is said about it (docs/features/mcp-connector.md, "Tokens").
export function connectionUseLine(
  { createdAt, lastUsedAt }: Pick<Connection, "createdAt" | "lastUsedAt">,
  now: Date,
  timeZone?: string,
): string {
  const created = new Date(createdAt);
  const used = new Date(lastUsedAt);
  const use =
    now.getTime() - used.getTime() < HOUR_MS
      ? "Used in the last hour"
      : dayKey(used, timeZone) === dayKey(now, timeZone)
        ? "Used today"
        : `Last used ${dayMonth(used, timeZone)}`;
  return `Connected ${dayMonth(created, timeZone)} · ${use}`;
}
