import { describe, expect, it } from "vitest";
import { chatWaitCopy } from "./chatWaitCopy.js";

describe("chatWaitCopy", () => {
  it("a spent month names the day it comes back, and upsells only plans that give more", () => {
    expect(chatWaitCopy({ kind: "month", resetsOn: "2026-12-01" }, "free", null)).toEqual({
      icon: "clock",
      heading: "You’ve asked this month’s 100 questions on us",
      body: "More on 1 December. BYO Plus gives 500 a month, Plus 1,000. Making overviews isn’t affected.",
      action: { kind: "seePlans", label: "See plans" },
    });
    expect(chatWaitCopy({ kind: "month", resetsOn: "2026-12-01" }, "byo-plus", null).action).toEqual({
      kind: "seePlus",
      label: "See Plus",
    });
    const plus = chatWaitCopy({ kind: "month", resetsOn: "2026-12-01" }, "plus", null);
    expect(plus.heading).toBe("You’ve asked this month’s 1,000 questions on us");
    expect(plus.action).toBeNull();
  });

  it("a day's limit and everyone's say tomorrow, with nothing to buy", () => {
    expect(chatWaitCopy({ kind: "day", retryAfterSeconds: 3600 }, "free", null).action).toBeNull();
    expect(chatWaitCopy({ kind: "everyone", retryAfterSeconds: 3600 }, "plus", null).body).toBe(
      "So many readers asked today that we’ve hit our own limit. Ask again tomorrow.",
    );
  });

  it("a full conversation offers a new one", () => {
    expect(chatWaitCopy({ kind: "conversationFull" }, "free", null)).toMatchObject({
      heading: "This conversation has 50 questions, the most one can hold.",
      body: "Start a new one. It can see this one.",
      action: { kind: "newConversation" },
    });
  });
});
