import { describe, expect, it } from "vitest";
import { SyncRequestError, SyncTransportError } from "@overview/sync";
import { chatWaitOf } from "./chatWaitOf.js";

const refused = (code: ConstructorParameters<typeof SyncRequestError>[0], details: Record<string, unknown>) =>
  new SyncRequestError(code, 429, "refused", details);

describe("chatWaitOf", () => {
  it("reads each limit as a wait with when it lifts", () => {
    expect(chatWaitOf(refused("too_many_requests", { quota: "chat-month", resetsOn: "2026-12-01" }))).toEqual({
      kind: "month",
      resetsOn: "2026-12-01",
    });
    expect(chatWaitOf(refused("too_many_requests", { quota: "chat-day", retryAfterSeconds: 3600 }))).toEqual({
      kind: "day",
      retryAfterSeconds: 3600,
    });
    expect(chatWaitOf(refused("too_many_requests", { quota: "chat-our-key-daily", retryAfterSeconds: 60 }))).toEqual({
      kind: "everyone",
      retryAfterSeconds: 60,
    });
  });

  it("reads a full conversation and an overview with nothing to answer from as states, not failures", () => {
    expect(chatWaitOf(refused("invalid_request", { conversation: "full" }))).toEqual({ kind: "conversationFull" });
    expect(chatWaitOf(refused("transcript_unavailable", { chat: "no-source" }))).toEqual({ kind: "noSource" });
  });

  it("leaves anything else to be a failure", () => {
    expect(chatWaitOf(refused("too_many_requests", { quota: "ours" }))).toBeNull();
    expect(chatWaitOf(refused("generation_failed", {}))).toBeNull();
    expect(chatWaitOf(new SyncTransportError("gone"))).toBeNull();
    expect(chatWaitOf(new Error("anything"))).toBeNull();
  });
});
