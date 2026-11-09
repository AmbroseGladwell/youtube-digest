export const SPEND_COLUMNS = ["date", "provider", "environment", "area", "dollars", "source", "reason", "quantity", "unit", "recorded_at"];

const cell = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const amount = (value, places) => (value === null || value === undefined ? "" : Number(value.toFixed(places)));

function cellsOf(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoted && character === '"' && line[index + 1] === '"') {
      current += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += character;
    }
  }
  return [...cells, current];
}

const numberOrNull = (text) => (text === "" ? null : Number(text));

export function parseSpendCsv(csv) {
  const [header, ...lines] = csv.split("\n").filter((line) => line !== "");
  const columns = cellsOf(header);
  return lines.map((line) => {
    const cells = Object.fromEntries(cellsOf(line).map((cell, index) => [columns[index], cell]));
    return {
      date: cells.date,
      provider: cells.provider,
      environment: cells.environment,
      area: cells.area,
      dollars: numberOrNull(cells.dollars ?? ""),
      source: cells.source,
      reason: cells.reason || undefined,
      quantity: numberOrNull(cells.quantity ?? ""),
      unit: cells.unit || undefined,
    };
  });
}

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
      amount(row.quantity, 6),
      row.unit ?? "",
      recordedAt,
    ]
      .map(cell)
      .join(","),
  );
  return `${[SPEND_COLUMNS.join(","), ...lines].join("\n")}\n`;
}
