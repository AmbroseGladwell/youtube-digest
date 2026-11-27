import { describe, expect, it } from "vitest";
import type { GenerationClient } from "@overview/generation";
import type { GenerationApi } from "@overview/sync";
import { checkKindOnKeys } from "./checkKindOnKeys.js";

const SAMPLE = { title: "Lasagne", by: "A cook", description: "", opening: "Today we make lasagne.", spoken: true };

const ownClient =
  (noteKind: string, calls: string[]): GenerationClient =>
  async () => {
    calls.push("own");
    return { noteKind };
  };

const ourApi = (calls: string[]) =>
  ({
    kindCheck: async () => {
      calls.push("ours");
      return { noteKind: "process" };
    },
  }) as unknown as GenerationApi;

describe("checkKindOnKeys", () => {
  it("checks on the reader's own key when that is the one written with first, never through us", async () => {
    const calls: string[] = [];

    const kind = await checkKindOnKeys(
      { order: ["own", "ours"], own: { provider: "openai", model: "m", client: ownClient("recipe", calls) }, api: ourApi(calls) },
      SAMPLE,
    );

    expect([kind, calls]).toEqual(["recipe", ["own"]]);
  });

  it("checks on our key when that is the one written with first", async () => {
    const calls: string[] = [];

    const kind = await checkKindOnKeys(
      { order: ["ours", "own"], own: { provider: "openai", model: "m", client: ownClient("recipe", calls) }, api: ourApi(calls) },
      SAMPLE,
    );

    expect([kind, calls]).toEqual(["process", ["ours"]]);
  });

  it("refuses with no key to check on", async () => {
    await expect(checkKindOnKeys({ order: ["ours"], own: null, api: null }, SAMPLE)).rejects.toThrow();
  });
});
