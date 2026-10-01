import type { ClientError } from "@overview/domain";
import type { ErrorSink, ErrorSource } from "./ErrorSink.js";

export interface RecordingErrorSink extends ErrorSink {
  captured: Array<{ errors: ClientError[]; source: ErrorSource }>;
  failing: boolean;
}

export function makeRecordingErrorSink(): RecordingErrorSink {
  const sink: RecordingErrorSink = {
    captured: [],
    failing: false,
    capture: async (errors, source) => {
      if (sink.failing) throw new Error("Simulated: the error tracker is down");
      sink.captured.push({ errors, source });
    },
  };
  return sink;
}
