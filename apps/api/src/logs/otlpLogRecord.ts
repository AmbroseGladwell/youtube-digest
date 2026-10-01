export type OtlpAnyValue =
  | { stringValue: string }
  | { boolValue: boolean }
  | { intValue: string }
  | { doubleValue: number };

export interface OtlpKeyValue {
  key: string;
  value: OtlpAnyValue;
}

export interface OtlpLogRecord {
  timeUnixNano: string;
  observedTimeUnixNano: string;
  severityNumber: number;
  severityText: string;
  body: OtlpAnyValue;
  attributes: OtlpKeyValue[];
}

const SEVERITIES: ReadonlyArray<[minLevel: number, number: number, text: string]> = [
  [60, 21, "FATAL"],
  [50, 17, "ERROR"],
  [40, 13, "WARN"],
  [30, 9, "INFO"],
  [20, 5, "DEBUG"],
  [0, 1, "TRACE"],
];

const PINO_OWN_FIELDS = new Set(["level", "time", "msg", "pid", "hostname"]);

export const otlpValue = (value: string | number | boolean): OtlpAnyValue =>
  typeof value === "string"
    ? { stringValue: value }
    : typeof value === "boolean"
      ? { boolValue: value }
      : Number.isInteger(value)
        ? { intValue: String(value) }
        : { doubleValue: value };

const flatten = (prefix: string, value: unknown, into: OtlpKeyValue[]): void => {
  if (value === null || value === undefined) return;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    into.push({ key: prefix, value: otlpValue(value) });
  } else if (Array.isArray(value)) {
    into.push({ key: prefix, value: { stringValue: JSON.stringify(value) } });
  } else if (typeof value === "object") {
    for (const [key, inner] of Object.entries(value)) flatten(`${prefix}.${key}`, inner, into);
  }
};

// One pino line as an OpenTelemetry log record: pino's level becomes a severity, its message
// the body, and every other field an attribute, nested ones by dotted path, so `reqId` and
// `failedRequestId` can be searched for directly (docs/architecture/errors-and-logs.md).
export function otlpLogRecord(line: Record<string, unknown>, observedAt: Date): OtlpLogRecord {
  const level = typeof line.level === "number" ? line.level : 30;
  const [, severityNumber, severityText] = SEVERITIES.find(([minLevel]) => level >= minLevel)!;
  const time = typeof line.time === "number" ? line.time : observedAt.getTime();
  const attributes: OtlpKeyValue[] = [];
  for (const [key, value] of Object.entries(line)) {
    if (!PINO_OWN_FIELDS.has(key)) flatten(key, value, attributes);
  }
  return {
    timeUnixNano: `${BigInt(Math.round(time)) * 1_000_000n}`,
    observedTimeUnixNano: `${BigInt(observedAt.getTime()) * 1_000_000n}`,
    severityNumber,
    severityText,
    body: { stringValue: typeof line.msg === "string" ? line.msg : "" },
    attributes,
  };
}
