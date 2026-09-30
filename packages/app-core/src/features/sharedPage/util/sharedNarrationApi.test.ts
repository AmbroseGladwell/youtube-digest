import { describe, expect, it } from "vitest";
import { sharedNarrationApi } from "./sharedNarrationApi.js";

const NARRATION = {
  key: "a".repeat(64),
  voice: "bf_emma" as const,
  durationSeconds: 364,
  lineStartsSeconds: [0, 12.5],
};

describe("sharedNarrationApi", () => {
  it("answers with the render the copy was shared with, whatever is asked of it", async () => {
    const api = sharedNarrationApi(NARRATION)!;

    const found = await api.peek(["any", "lines"], "am_michael");

    expect(found?.voice).toBe("bf_emma");
    expect(found?.render).toMatchObject({ key: NARRATION.key, status: "ready", durationSeconds: 364 });
  });

  it("points at the public, content-addressed file every other player uses", () => {
    const api = sharedNarrationApi(NARRATION)!;

    expect(api.fileUrl({ fileUrl: `/api/audio/${NARRATION.key}/file` })).toBe(
      `/api/audio/${NARRATION.key}/file`,
    );
  });

  // Which is what makes the player fall back to the pacer, as it does for any reader with
  // no account behind them.
  it("is absent for a copy shared without narration", () => {
    expect(sharedNarrationApi(null)).toBeNull();
  });
});
