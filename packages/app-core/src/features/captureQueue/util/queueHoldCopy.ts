import { resumeTimeText } from "../../transcripts/util/resumeTime.js";
import type { QueueHold } from "../types/QueueHold.js";

const count = (n: number) => n.toLocaleString("en-GB");

// One pattern for every limit the queue waits at, with a different reason and resume time;
// the extension is named only where it would be a way around
// (docs/features/capture-queue.md, "Waiting at a limit").
export function queueHoldStripMeta(hold: QueueHold, waiting: number, viaExtension: boolean): string {
  const time = resumeTimeText(new Date(hold.resumesAt));
  const continues = `${waiting === 1 ? "it continues" : "these continue"} after ${time}`;
  switch (hold.reason) {
    case "serverCap":
      return `${count(waiting)} waiting · ${continues}${viaExtension ? ", or now with the extension" : ""}`;
    case "serverBusy":
      return `${count(waiting)} waiting · it asked us to slow down · ${continues}`;
  }
}

export function queueHoldNote(hold: QueueHold, waiting: number, viaExtension: boolean): string {
  const time = resumeTimeText(new Date(hold.resumesAt));
  const subject = waiting === 1 ? "The waiting video continues" : "These continue";
  switch (hold.reason) {
    case "serverCap":
      return `Our server has fetched as many transcripts for you as it can today. ${subject} after ${time}${viaExtension ? ", or now with the extension" : ""}. Nothing has failed.`;
    case "serverBusy":
      return `Our server asked us to slow down for a moment. ${subject} after ${time}. Nothing has failed.`;
  }
}
