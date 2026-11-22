import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { commentsIn } from "./checkStyleComments.mjs";

const STYLE_FILES = ["*.scss", "*.css"];
const LEFT_ALONE = /^(prototype|samples)\//;
const FONT_SIZE = /(?:^|[;{\s])font(?:-size)?\s*:\s*([^;{}]+)/g;

const lineAt = (text, offset) => text.slice(0, offset).split("\n").length;

const withoutComments = (text) => {
  let kept = text;
  for (const comment of commentsIn(text)) {
    kept = kept.slice(0, comment.start) + " ".repeat(comment.end - comment.start) + kept.slice(comment.end);
  }
  return kept;
};

const ignoresTheTextSetting = (value) => /\d(\.\d+)?px\b/.test(value) && !/\d(\.\d+)?r?em\b/.test(value);

export const styleFontSizeProblems = (text) =>
  [...withoutComments(text).matchAll(FONT_SIZE)]
    .filter((match) => ignoresTheTextSetting(match[1]))
    .map((match) => ({ line: lineAt(text, match.index + match[0].indexOf("font")), value: match[1].trim() }));

const main = () => {
  const named = process.argv.slice(2);
  const files =
    named.length > 0
      ? named
      : execFileSync("git", ["ls-files", ...STYLE_FILES], { encoding: "utf8" })
          .trim()
          .split("\n");
  let found = 0;
  for (const file of files.filter((each) => each !== "" && !LEFT_ALONE.test(each))) {
    for (const { line, value } of styleFontSizeProblems(readFileSync(file, "utf8"))) {
      console.error(
        `${file}:${line}  font size ${value} ignores the reader's browser text size: use rem (px ÷ 16), or max(16px, 1rem) for a floor (docs/conventions/frontend-architecture-guide.md)`,
      );
      found += 1;
    }
  }
  if (found > 0) {
    process.exitCode = 1;
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
