import { describe, expect, it } from "vitest";
import { queueHoldNote, queueHoldStripMeta } from "./queueHoldCopy.js";

const resumesAt = new Date(2026, 9, 7, 1, 0).getTime();

describe("queueHoldCopy", () => {
  it("at the daily cap, writes the resume time out and names the extension only where it would help", () => {
    expect(queueHoldStripMeta({ reason: "serverCap", resumesAt }, 9, true)).toBe("9 waiting · these continue after 01:00, or now with the extension");
    expect(queueHoldStripMeta({ reason: "serverCap", resumesAt }, 1, false)).toBe("1 waiting · it continues after 01:00");
    expect(queueHoldNote({ reason: "serverCap", resumesAt }, 2, true)).toBe(
      "Our server has fetched as many transcripts for you as it can today. These continue after 01:00, or now with the extension. Nothing has failed.",
    );
  });

  it("asked to slow down, says so with when it continues, and offers no way around a moment's wait", () => {
    expect(queueHoldStripMeta({ reason: "serverBusy", resumesAt }, 3, true)).toBe("3 waiting · it asked us to slow down · these continue after 01:00");
    expect(queueHoldNote({ reason: "serverBusy", resumesAt }, 1, true)).toBe(
      "Our server asked us to slow down for a moment. The waiting video continues after 01:00. Nothing has failed.",
    );
  });
});
