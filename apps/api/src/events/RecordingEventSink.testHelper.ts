import type { EventSink, EventSource, SinkEvent } from "./EventSink.js";

export interface RecordingEventSink extends EventSink {
  captured: Array<{ events: SinkEvent[]; source: EventSource }>;
  links: Array<{ accountId: string; anonymousId: string }>;
  failing: boolean;
}

export function makeRecordingEventSink(): RecordingEventSink {
  const sink: RecordingEventSink = {
    captured: [],
    links: [],
    failing: false,
    capture: async (events, source) => {
      if (sink.failing) throw new Error("Simulated: the analytics service is down");
      sink.captured.push({ events, source });
    },
    link: async (accountId, anonymousId) => {
      if (sink.failing) throw new Error("Simulated: the analytics service is down");
      sink.links.push({ accountId, anonymousId });
    },
  };
  return sink;
}
