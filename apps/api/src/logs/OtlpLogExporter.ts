import { otlpLogRecord, otlpValue, type OtlpLogRecord } from "./otlpLogRecord.js";

export interface OtlpLogExporterOptions {
  endpoint: string;
  headers: Record<string, string>;
  resource: Record<string, string>;
  fetch?: typeof fetch;
  now?: () => Date;
  flushIntervalMs?: number;
  maxBatchRecords?: number;
  maxHeldRecords?: number;
  timeoutMs?: number;
  // Told when a batch couldn't be shipped. Never the logger: that would ship the complaint.
  onFailure?: (message: string) => void;
}

const SCOPE = { name: "overview-api" };

// pino's lines, batched and posted as OTLP/HTTP JSON to whatever the OTEL_* variables name.
// No SDK and no worker thread: a slow or absent destination costs held lines, never a
// request, and what is lost is said as a record of its own in the next batch that gets
// through (docs/architecture/errors-and-logs.md, "Shipping the server's logs").
export class OtlpLogExporter {
  readonly #options: Required<Omit<OtlpLogExporterOptions, "onFailure">> & Pick<OtlpLogExporterOptions, "onFailure">;
  #held: OtlpLogRecord[] = [];
  #dropped = 0;
  #timer: ReturnType<typeof setInterval>;
  #inFlight: Promise<void> = Promise.resolve();

  constructor({
    fetch: fetchImpl = globalThis.fetch,
    now = () => new Date(),
    flushIntervalMs = 2_000,
    maxBatchRecords = 500,
    maxHeldRecords = 5_000,
    timeoutMs = 10_000,
    ...rest
  }: OtlpLogExporterOptions) {
    this.#options = { fetch: fetchImpl, now, flushIntervalMs, maxBatchRecords, maxHeldRecords, timeoutMs, ...rest };
    this.#timer = setInterval(() => void this.flush(), flushIntervalMs);
    this.#timer.unref();
  }

  write(chunk: string): void {
    for (const line of chunk.split("\n")) {
      if (line.trim() === "") continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }
      if (typeof parsed !== "object" || parsed === null) continue;
      if (this.#held.length >= this.#options.maxHeldRecords) {
        this.#dropped += 1;
        continue;
      }
      this.#held.push(otlpLogRecord(parsed as Record<string, unknown>, this.#options.now()));
      if (this.#held.length >= this.#options.maxBatchRecords) void this.flush();
    }
  }

  flush(): Promise<void> {
    this.#inFlight = this.#inFlight.then(() => this.#sendHeld());
    return this.#inFlight;
  }

  async close(): Promise<void> {
    clearInterval(this.#timer);
    await this.flush();
  }

  async #sendHeld(): Promise<void> {
    while (this.#held.length > 0 || this.#dropped > 0) {
      const records = this.#held.splice(0, this.#options.maxBatchRecords);
      const dropped = this.#dropped;
      this.#dropped = 0;
      const batch = dropped === 0 ? records : [this.#droppedRecord(dropped), ...records];
      try {
        await this.#post(batch);
      } catch (error) {
        this.#dropped += dropped + records.length;
        this.#options.onFailure?.(String(error));
        return;
      }
    }
  }

  #droppedRecord(dropped: number): OtlpLogRecord {
    const at = `${BigInt(this.#options.now().getTime()) * 1_000_000n}`;
    return {
      timeUnixNano: at,
      observedTimeUnixNano: at,
      severityNumber: 13,
      severityText: "WARN",
      body: { stringValue: "log records dropped" },
      attributes: [{ key: "dropped", value: otlpValue(dropped) }],
    };
  }

  async #post(logRecords: OtlpLogRecord[]): Promise<void> {
    const { endpoint, headers, resource, fetch: fetchImpl, timeoutMs } = this.#options;
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        resourceLogs: [
          {
            resource: { attributes: Object.entries(resource).map(([key, value]) => ({ key, value: otlpValue(value) })) },
            scopeLogs: [{ scope: SCOPE, logRecords }],
          },
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`the log destination answered ${response.status}`);
  }
}
