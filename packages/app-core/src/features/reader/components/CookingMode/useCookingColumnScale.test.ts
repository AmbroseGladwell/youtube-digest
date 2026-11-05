import { describe, expect, it } from "vitest";
import { columnScale } from "./useCookingColumnScale.js";

describe("columnScale", () => {
  it("keeps the full scale from 720px up", () => {
    expect(columnScale(720)).toBe("full");
    expect(columnScale(820)).toBe("full");
  });

  it("steps down to the narrow scale under 720px", () => {
    expect(columnScale(719)).toBe("narrow");
    expect(columnScale(480)).toBe("narrow");
  });

  it("takes the phone's scale under 480px", () => {
    expect(columnScale(479)).toBe("compact");
    expect(columnScale(0)).toBe("compact");
  });
});
