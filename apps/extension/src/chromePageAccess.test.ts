import { describe, expect, it } from "vitest";
import { pagePermission } from "./chromePageAccess.js";

describe("pagePermission", () => {
  it("asks for the one site the page is on", () => {
    expect(pagePermission("https://news.example.com/2026/story?id=1")).toBe("https://news.example.com/*");
  });

  it("leaves a port out, which a match pattern cannot hold", () => {
    expect(pagePermission("http://localhost:3000/post")).toBe("http://localhost/*");
  });

  it("asks for nothing on a page that is not on the web", () => {
    expect(pagePermission("chrome://extensions")).toBeNull();
    expect(pagePermission("file:///tmp/a.html")).toBeNull();
    expect(pagePermission("not a url")).toBeNull();
  });
});
