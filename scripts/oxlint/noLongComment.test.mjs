import { noLongComment } from "./noLongComment.mjs";
import { ruleTester } from "./ruleTester.mjs";

ruleTester.run("no-long-comment", noLongComment, {
  valid: [
    "// Safari drops the first frame: https://bugs.webkit.org/show_bug.cgi?id=1\nconst a = 1;",
    "/* one line */ const a = 1;",
    "// first\nconst a = 1;\n// second\nconst b = 2;",
    "// @ts-expect-error the library's types miss this overload\n// oxlint-disable-next-line no-console\nconsole.log(a);",
    "const url = 'http://example.com // not a comment';",
  ],
  invalid: [
    { code: "// This explains\n// at length.\nconst a = 1;", errors: [{ messageId: "long", line: 1, endLine: 2 }] },
    { code: "/**\n * Restates the signature.\n */\nconst a = 1;", errors: [{ messageId: "long", line: 1 }] },
    { code: "  // indented\n  // run\nconst a = 1;", errors: [{ messageId: "long" }] },
    { code: "// TODO: tidy this up\nconst a = 1;", errors: [{ messageId: "marker" }] },
  ],
});
