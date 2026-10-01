/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";

const sources = import.meta.glob<string>(["./**/*.{ts,tsx}", "!./**/*.test.ts"], {
  query: "?raw",
  import: "default",
  eager: true,
});

describe("session storage", () => {
  it("is never opened to content scripts, because it holds the reader's session for the worker", () => {
    expect(Object.keys(sources)).toContain("./errorDestination.ts");
    expect(Object.entries(sources).filter(([, source]) => source.includes("setAccessLevel")).map(([file]) => file)).toEqual([]);
  });
});
