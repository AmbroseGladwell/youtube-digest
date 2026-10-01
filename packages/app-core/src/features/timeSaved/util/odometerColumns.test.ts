import { describe, expect, it } from "vitest";
import { odometerColumns } from "./odometerColumns.js";

const rowsOf = (from: number, to: number) =>
  Object.fromEntries(odometerColumns(from, to).map((column) => [column.key, column.rows]));

describe("odometerColumns", () => {
  it("rolls the units through every minute between the two values", () => {
    expect(rowsOf(3, 7)).toEqual({ units: ["3", "4", "5", "6", "7"] });
  });

  it("wraps the units and carries into the tens", () => {
    expect(rowsOf(587, 604)).toEqual({
      hours: ["9", "10"],
      tens: ["4", "5", "0"],
      units: ["7", "8", "9", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "1", "2", "3", "4"],
    });
  });

  it("lists a fall in the order it rolls back, so the strip runs the other way", () => {
    const [units] = odometerColumns(12, 9).filter((column) => column.key === "units");

    expect(units).toMatchObject({ up: false, rows: ["9", "0", "1", "2"] });
  });

  it("keeps a long roll to its first digit and the last twenty", () => {
    const [units] = odometerColumns(0, 100).filter((column) => column.key === "units");

    expect(units!.rows).toHaveLength(21);
    expect(units!.rows[0]).toBe("0");
    expect(units!.rows.at(-1)).toBe("0");
  });
});
