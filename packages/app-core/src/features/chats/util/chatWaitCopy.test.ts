import { describe, expect, it } from "vitest";
import { chatWaitCopy } from "./chatWaitCopy.js";

describe("chatWaitCopy", () => {
  it("a spent month says chat is used, when it's back, that overviews keep working, and upsells only plans that give more (376d)", () => {
    expect(chatWaitCopy({ kind: "month", resetsOn: "2026-12-01" }, "free", null)).toEqual({
      icon: "clock",
      heading: "You’ve used this month’s chat",
      body: "More on 1 December. Your overviews, and everything you’ve saved, keep working.",
      action: { kind: "seePlans", label: "See plans" },
    });
    expect(chatWaitCopy({ kind: "month", resetsOn: "2026-12-01" }, "byo-plus", null).action).toEqual({
      kind: "seePlus",
      label: "See Plus",
    });
    expect(chatWaitCopy({ kind: "month", resetsOn: "2026-12-01" }, "plus", null).action).toBeNull();
  });

  it("too little left for a library question says overview questions still work until the reset (376h)", () => {
    expect(chatWaitCopy({ kind: "libraryMonth", resetsOn: "2026-12-01" }, "free", null)).toEqual({
      icon: "clock",
      heading: "Not enough chat left for a library question",
      body: "A question across your library needs more than you have left this month. Questions about one overview still work until 1 December.",
      action: { kind: "seePlans", label: "See plans" },
    });
    expect(chatWaitCopy({ kind: "libraryMonth", resetsOn: "2026-12-01" }, "plus", null).action).toBeNull();
  });

  it("a day's limit and everyone's say tomorrow, in usage words, with nothing to buy (376e, 376f)", () => {
    expect(chatWaitCopy({ kind: "day", retryAfterSeconds: 3600 }, "free", null)).toMatchObject({
      heading: "That’s the most chat for one day",
      body: "Ask again tomorrow. The rest of this month’s chat is still yours.",
      action: null,
    });
    expect(chatWaitCopy({ kind: "everyone", retryAfterSeconds: 3600 }, "plus", null)).toMatchObject({
      heading: "Chat is paused for everyone today",
      body: "So many readers asked today that we’ve hit our own limit. Ask again tomorrow. Your allowance isn’t touched.",
    });
  });

  it("a full conversation offers a new one", () => {
    expect(chatWaitCopy({ kind: "conversationFull" }, "free", null)).toMatchObject({
      heading: "This conversation has 50 questions, the most one can hold.",
      body: "Start a new one. It can see this one.",
      action: { kind: "newConversation" },
    });
  });
});
