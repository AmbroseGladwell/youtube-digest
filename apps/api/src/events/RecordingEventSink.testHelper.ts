import type { EventSink, EventSource, SinkEvent } from "./EventSink.js";

export interface RecordingEventSink extends EventSink {
  captured: Array<{ events: SinkEvent[]; source: EventSource }>;
  failing: boolean;
}

export function makeRecordingEventSink(): RecordingEventSink {
  const sink: RecordingEventSink = {
    captured: [],
    failing: false,
    capture: async (events, source) => {
      if (sink.failing) throw new Error("Simulated: the analytics service is down");
      sink.captured.push({ events, source });
    },
  };
  return sink;
}
