import { describe, expect, it } from "vitest";
import { connectionProfileLine } from "./connectionProfileLine.js";

describe("connectionProfileLine", () => {
  it("says a connection holding the scope can read it while sharing is on", () => {
    expect(connectionProfileLine(true, true)).toBe("Can read what we know about you");
  });

  it("says where it was turned off when the reader's switch is off", () => {
    expect(connectionProfileLine(true, false)).toBe("Can’t read what we know about you: it’s off in Personalisation");
  });

  it("says a connection approved before the scope needs reconnecting, whatever the switch", () => {
    expect(connectionProfileLine(false, true)).toBe("Can’t read what we know about you until it’s reconnected");
    expect(connectionProfileLine(false, false)).toBe("Can’t read what we know about you until it’s reconnected");
  });
});
