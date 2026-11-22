import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { noRepeatedString } from "./noRepeatedString.mjs";
import { ruleTester } from "./ruleTester.mjs";

const repo = mkdtempSync(join(tmpdir(), "no-repeated-string-"));
mkdirSync(join(repo, "src"));
writeFileSync(join(repo, "src", "other.ts"), 'export const label = "Sign in again";\nexport const path = "/generations/profile";\n');
writeFileSync(join(repo, "src", "other.test.ts"), 'expect(x).toBe("Only in a test");\n');

ruleTester.run("no-repeated-string", noRepeatedString, {
  valid: [
    'const a = "Sign in"; const b = "Open it";',
    'const kind = a === "in-progress" ? 1 : b === "in-progress" ? 2 : 3;',
    'import x from "./a.js"; import y from "./a.js";',
    'switch (k) { case "a b": break; } switch (j) { case "a b": break; }',
    'type T = "a b" | "c d"; type U = "a b";',
    'const o = { "a key": 1 }; const p = { "a key": 2 };',
    '<><input type="text" /><input type="text" /></>;',
    "const a = `/api/one`; const b = '/api/two';",
    { code: 'const mine = "Only in a test";', cwd: repo, filename: join(repo, "src", "here.ts"), options: [{ acrossFiles: true }] },
    { code: 'const mine = "Sign in again";', cwd: repo, filename: join(repo, "src", "here.ts") },
    { code: 'const mine = "Sign in again";', cwd: repo, filename: join(repo, "src", "here.ts"), options: [{ acrossFiles: true }] },
  ],
  invalid: [
    { code: 'const a = "Open the recipe"; const b = "Open the recipe";', errors: [{ messageId: "repeated" }] },
    { code: 'fetch("/generations/profile"); fetch(`/generations/profile`); fetch("/generations/profile");', errors: 2 },
    {
      code: 'fetch("/generations/profile");',
      cwd: repo,
      filename: join(repo, "src", "here.ts"),
      options: [{ acrossFiles: true }],
      errors: [{ messageId: "shared", data: { other: "src/other.ts" } }],
    },
  ],
});
