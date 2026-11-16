import { describe, expect, it } from "vitest";
import type { NoteLine } from "@overview/domain";
import { citedLineIndex } from "./citedLineIndex.js";

const line = (text: string, range?: { startMs: number; endMs: number }, heading = false): NoteLine =>
  ({ section: "Key points", text, heading, bullet: !heading, ...(range === undefined ? {} : { range }) }) as NoteLine;

const lines = [
  line("Key points", undefined, true),
  line("Dose", { startMs: 128_000, endMs: 176_000 }),
  line("Lean mass", { startMs: 208_000, endMs: 263_000 }),
  line("No moment"),
  line("Brain", { startMs: 499_000, endMs: 523_000 }),
];

describe("citedLineIndex", () => {
  it("finds the line whose stretch holds the cited time", () => {
    expect(citedLineIndex(lines, 210_000)).toBe(2);
    expect(citedLineIndex(lines, 499_000)).toBe(4);
  });

  it("between stretches, takes the latest line starting before it", () => {
    expect(citedLineIndex(lines, 300_000)).toBe(2);
  });

  it("before every moment, finds none", () => {
    expect(citedLineIndex(lines, 10_000)).toBeNull();
  });
});
