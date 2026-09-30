import { describe, expect, it } from "vitest";
import { ShareToken, shareSnapshot } from "@overview/domain";
import { makeOverview } from "../../overviews/types/OverviewFactory.testHelper.js";
import {
  forgetSharedPageIntent,
  readSharedPageIntent,
  rememberSharedPageIntent,
} from "./sharedPageIntent.js";

const storage = (): Storage => {
  const held = new Map<string, string>();
  return {
    getItem: (key) => held.get(key) ?? null,
    setItem: (key, value) => void held.set(key, value),
    removeItem: (key) => void held.delete(key),
    clear: () => held.clear(),
    key: () => null,
    length: 0,
  };
};

const refusing = (): Storage => ({
  ...storage(),
  getItem: () => {
    throw new Error("site data is blocked");
  },
  setItem: () => {
    throw new Error("site data is blocked");
  },
});

describe("sharedPageIntent", () => {
  it("carries a pasted link through making an account", () => {
    const store = storage();
    rememberSharedPageIntent({ kind: "generate", videoUrl: "https://www.youtube.com/watch?v=abc" }, store);

    expect(readSharedPageIntent(store)).toEqual({
      kind: "generate",
      videoUrl: "https://www.youtube.com/watch?v=abc",
    });
  });

  it("carries the shared copy itself, so saving it needs no second request", () => {
    const store = storage();
    const snapshot = shareSnapshot({ overview: makeOverview(), transcript: null, narration: null });
    rememberSharedPageIntent(
      { kind: "save", token: ShareToken.parse("k7Qm2x9RfTabcdef"), title: "A title", snapshot },
      store,
    );

    const read = readSharedPageIntent(store);
    expect(read?.kind).toBe("save");
    expect(read?.kind === "save" && read.snapshot.note.id).toBe(snapshot.note.id);
  });

  it("forgets it once it has been acted on, so it fires once", () => {
    const store = storage();
    rememberSharedPageIntent({ kind: "generate", videoUrl: "https://www.youtube.com/watch?v=abc" }, store);

    forgetSharedPageIntent(store);

    expect(readSharedPageIntent(store)).toBeNull();
  });

  it("reads nothing from a shape an older build wrote, rather than throwing", () => {
    const store = storage();
    store.setItem("overview.sharedPageIntent.v1", JSON.stringify({ kind: "somethingElse" }));

    expect(readSharedPageIntent(store)).toBeNull();
  });

  it("costs the visitor the hand-off, not the account, when site data is refused", () => {
    const blocked = refusing();

    expect(() => rememberSharedPageIntent({ kind: "generate", videoUrl: "https://y.t/x" }, blocked)).not.toThrow();
    expect(readSharedPageIntent(blocked)).toBeNull();
  });
});
