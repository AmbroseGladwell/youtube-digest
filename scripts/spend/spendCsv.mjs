export const SPEND_COLUMNS = ["date", "provider", "environment", "area", "dollars", "source", "reason", "recorded_at"];

const cell = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export function spendCsv(rows, recordedAt) {
  const lines = rows.map((row) =>
    [
      row.date,
      row.provider,
      row.environment,
      row.area,
      row.dollars === null || row.dollars === undefined ? "" : row.dollars.toFixed(6),
      row.source,
      row.reason ?? "",
      recordedAt,
    ]
      .map(cell)
      .join(","),
  );
  return `${[SPEND_COLUMNS.join(","), ...lines].join("\n")}\n`;
}
