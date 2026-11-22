import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const MARKER = /\b(TODO|FIXME|XXX|HACK)\b/;
const STYLE_FILES = ["*.scss", "*.css"];
const LEFT_ALONE = /^(prototype|samples)\//;

const lineAt = (text, offset) => text.slice(0, offset).split("\n").length;

const skipQuoted = (text, start) => {
  const quote = text[start];
  let at = start + 1;
  while (at < text.length && text[at] !== quote && text[at] !== "\n") {
    at += text[at] === "\\" ? 2 : 1;
  }
  return at + 1;
};

const skipUrl = (text, start) => {
  const close = text.indexOf(")", start);
  return close === -1 ? text.length : close + 1;
};

const commentsIn = (text) => {
  const comments = [];
  let at = 0;
  while (at < text.length) {
    const char = text[at];
    if (char === '"' || char === "'") {
      at = skipQuoted(text, at);
    } else if (text.startsWith("url(", at)) {
      at = skipUrl(text, at);
    } else if (text.startsWith("/*", at)) {
      const close = text.indexOf("*/", at + 2);
      const end = close === -1 ? text.length : close + 2;
      comments.push({ kind: "block", start: at, end, body: text.slice(at + 2, end - 2) });
      at = end;
    } else if (text.startsWith("//", at)) {
      const newline = text.indexOf("\n", at);
      const end = newline === -1 ? text.length : newline;
      comments.push({ kind: "line", start: at, end, body: text.slice(at + 2, end) });
      at = end;
    } else {
      at += 1;
    }
  }
  return comments;
};

const runsOf = (text, comments) => {
  const runs = [];
  for (const comment of comments) {
    const previous = runs.at(-1);
    const joins =
      previous?.kind === "line" && comment.kind === "line" && /^[ \t]*\r?\n[ \t]*$/.test(text.slice(previous.end, comment.start));
    if (joins) {
      previous.end = comment.end;
    } else {
      runs.push({ ...comment });
    }
  }
  return runs;
};

export const styleCommentProblems = (text) => {
  const comments = commentsIn(text);
  const markers = comments
    .filter((comment) => MARKER.test(comment.body))
    .map((comment) => ({ line: lineAt(text, comment.start), problem: "marker" }));
  const long = runsOf(text, comments)
    .filter((run) => lineAt(text, run.end) > lineAt(text, run.start))
    .map((run) => ({ line: lineAt(text, run.start), problem: "long" }));
  return [...markers, ...long].sort((a, b) => a.line - b.line);
};

const MESSAGES = {
  long: "a comment is one line at most: name it with a Sass variable, or point at the doc that holds the reason (docs/conventions/commenting.md)",
  marker: "no TODO or FIXME comments: the work goes on a Trello card (docs/conventions/commenting.md)",
};

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
    for (const { line, problem } of styleCommentProblems(readFileSync(file, "utf8"))) {
      console.error(`${file}:${line}  ${MESSAGES[problem]}`);
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
