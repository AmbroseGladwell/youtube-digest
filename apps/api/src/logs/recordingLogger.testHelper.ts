import { createLogger } from "./createLogger.js";

export type LogLine = Record<string, unknown> & { level: number; msg: string; reqId?: string };

export const LOG_LEVELS = { info: 30, warn: 40, error: 50 } as const;

// The real logger, serializers included, writing to an array a test can read.
export function recordingLogger() {
  const lines: LogLine[] = [];
  const logger = createLogger([{ write: (chunk: string) => void lines.push(JSON.parse(chunk)) }]);
  return { lines, logger };
}
