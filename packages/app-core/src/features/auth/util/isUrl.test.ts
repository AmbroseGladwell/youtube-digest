import { describe, expect, it } from "vitest";
import { isUrl } from "./isUrl.js";

describe("isUrl", () => {
  it.each(["http://localhost:3000", "https://sync.example.com", "https://staging.sync.test/"])("accepts %s", (value) => {
    expect(isUrl(value)).toBe(true);
  });

  it.each(["", "not a server", "localhost:3000", "sync.example.com", "ftp://sync.example.com"])("refuses %j", (value) => {
    expect(isUrl(value)).toBe(false);
  });
});
