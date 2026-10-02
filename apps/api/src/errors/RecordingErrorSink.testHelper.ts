import type { ClientError } from "@overview/domain";
import type { ErrorSink, ErrorSource, ServerError } from "./ErrorSink.js";

export interface RecordingErrorSink extends ErrorSink {
  captured: Array<{ errors: ClientError[]; source: ErrorSource }>;
  serverErrors: ServerError[];
  failing: boolean;
}

export function makeRecordingErrorSink(): RecordingErrorSink {
  const sink: RecordingErrorSink = {
    captured: [],
    serverErrors: [],
    failing: false,
    capture: async (errors, source) => {
      if (sink.failing) throw new Error("Simulated: the error tracker is down");
      sink.captured.push({ errors, source });
    },
    captureServerError: async (error) => {
      if (sink.failing) throw new Error("Simulated: the error tracker is down");
      sink.serverErrors.push(error);
    },
  };
  return sink;
}
