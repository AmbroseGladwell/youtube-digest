export interface OdometerColumn {
  key: "hours" | "tens" | "units";
  rows: string[];
  up: boolean;
  delayMs: number;
  durationMs: number;
  suffix: string;
}

const MAX_ROWS = 21;

const steps = (from: number, to: number): number[] => {
  const direction = to >= from ? 1 : -1;
  return Array.from({ length: Math.abs(to - from) + 1 }, (_, index) => from + index * direction);
};

const capped = (rows: number[]): number[] =>
  rows.length > MAX_ROWS ? [rows[0]!, ...rows.slice(-(MAX_ROWS - 1))] : rows;

// The strips a rolling total turns through, minutes first and carrying into tens and then
// hours like a mechanical counter. Each strip lists the digits it passes from the old value
// to the new, top to bottom in the direction it travels (docs/features/time-saved.md).
export function odometerColumns(from: number, to: number): OdometerColumn[] {
  const up = to >= from;
  const ordered = (rows: number[]) => (up ? rows : [...rows].reverse()).map(String);
  const largest = Math.max(from, to);
  const columns: OdometerColumn[] = [];

  if (largest >= 60) {
    const hours = capped(steps(Math.floor(from / 60), Math.floor(to / 60)));
    columns.push({ key: "hours", rows: ordered(hours), up, delayMs: 380, durationMs: 700, suffix: "h " });
  }
  if (largest >= 10) {
    const tens = capped(steps(Math.floor(from / 10), Math.floor(to / 10))).map((value) => value % 6);
    columns.push({ key: "tens", rows: ordered(tens), up, delayMs: 200, durationMs: 750, suffix: "" });
  }
  const units = capped(steps(from, to)).map((value) => value % 10);
  columns.push({ key: "units", rows: ordered(units), up, delayMs: 0, durationMs: 1000, suffix: "m" });
  return columns;
}
