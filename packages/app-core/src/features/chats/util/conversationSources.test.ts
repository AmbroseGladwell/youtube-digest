import { describe, expect, it } from "vitest";
import type { ChatMessage, ChatSource } from "@overview/domain";
import { conversationSources } from "./conversationSources.js";

const AT = "2026-11-21T09:00:00.000Z";
const source = (label: string, overviewId: string, how: ChatSource["how"] = "found"): ChatSource => ({
  label,
  overviewId: overviewId as ChatSource["overviewId"],
  title: label,
  how,
});
const asked = (extra: Partial<Extract<ChatMessage, { from: "reader" }>>): ChatMessage => ({ from: "reader", text: "Q", at: AT, ...extra });

describe("conversationSources", () => {
  it("keeps every source the conversation added, minus those set aside since", () => {
    const chat = {
      messages: [
        asked({ sources: [source("S1", "a", "pinned"), source("S2", "b")] }),
        asked({ sources: [source("S3", "c")], setAside: ["S2"] }),
      ],
    };
    expect(conversationSources(chat).live.map((each) => each.label)).toEqual(["S1", "S3"]);
  });

  it("remembers Search my library as the last question left it, on by default", () => {
    expect(conversationSources(null).searchLibrary).toBe(true);
    expect(conversationSources({ messages: [asked({ searchedLibrary: false })] }).searchLibrary).toBe(false);
    expect(conversationSources({ messages: [asked({ searchedLibrary: false }), asked({})] }).searchLibrary).toBe(true);
  });
});
