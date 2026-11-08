import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE = join(import.meta.dirname, "..");

const sourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(scss|tsx?)$/.test(entry.name) ? [path] : [];
  });

const files = sourceFiles(SOURCE).map((path) => ({ path: relative(SOURCE, path), text: readFileSync(path, "utf8") }));

const declared = new Set(
  files.flatMap(({ text }) => [
    ...[...text.matchAll(/(--[a-zA-Z][\w-]*)\s*:/g)].map((match) => match[1]),
    ...[...text.matchAll(/["'`](--[a-zA-Z][\w-]*)["'`]/g)].map((match) => match[1]),
  ]),
);

const undeclared = files.flatMap(({ path, text }) =>
  [...text.matchAll(/var\(\s*(--[a-zA-Z][\w-]*)\s*\)/g)]
    .map((match) => match[1] as string)
    .filter((name) => !declared.has(name))
    .map((name) => `${path}: ${name}`),
);

describe("custom properties", () => {
  it("finds the tokens it checks against", () => {
    expect(declared).toContain("--label");
    expect(declared).toContain("--mini-player-clearance");
  });

  it("only reads a custom property, without a fallback, that something declares", () => {
    expect(undeclared).toEqual([]);
  });
});
