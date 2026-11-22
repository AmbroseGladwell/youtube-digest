import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const CONFIG = ".oxlintrc.changed-lines.json";
const SOURCE_GLOBS = ["*.ts", "*.tsx", "*.mts", "*.cts", "*.js", "*.mjs", "*.cjs"];
const HUNK = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

const movedOut = (removed, text) => {
  const count = removed.get(text) ?? 0;
  if (count === 0) {
    return false;
  }
  removed.set(text, count - 1);
  return true;
};

const newLinesOf = (changes) => {
  const removed = new Map();
  for (const change of changes.filter((each) => each.removed)) {
    removed.set(change.text, (removed.get(change.text) ?? 0) + 1);
  }
  return new Set(changes.filter((each) => !each.removed && !movedOut(removed, each.text)).map((each) => each.line));
};

export const addedLinesOf = (diff) => {
  const changesByFile = new Map();
  let changes = null;
  let next = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ ")) {
      changes = line === "+++ /dev/null" ? null : [];
      if (changes !== null) {
        changesByFile.set(line.slice("+++ b/".length), changes);
      }
      continue;
    }
    if (line.startsWith("--- ") || changes === null) {
      continue;
    }
    const hunk = HUNK.exec(line);
    if (hunk !== null) {
      next = Number(hunk[1]);
      continue;
    }
    if (line.startsWith("+")) {
      changes.push({ removed: false, line: next, text: line.slice(1).trim() });
      next++;
    } else if (line.startsWith("-")) {
      changes.push({ removed: true, text: line.slice(1).trim() });
    }
  }
  const added = new Map();
  for (const [file, fileChanges] of changesByFile) {
    const lines = newLinesOf(fileChanges);
    if (lines.size > 0) {
      added.set(file, lines);
    }
  }
  return added;
};

const NEWLINE = 0x0a;

const spanLines = (span, bytes) => {
  let last = span.line;
  for (let at = span.offset; at < span.offset + span.length; at++) {
    if (bytes[at] === NEWLINE) {
      last++;
    }
  }
  return { first: span.line, last };
};

export const onAddedLines = (diagnostics, added, bytesOf = readFileSync) =>
  diagnostics.filter((diagnostic) => {
    const lines = added.get(diagnostic.filename);
    if (lines === undefined || diagnostic.labels.length === 0) {
      return false;
    }
    const { first, last } = spanLines(diagnostic.labels[0].span, bytesOf(diagnostic.filename));
    for (let line = first; line <= last; line++) {
      if (lines.has(line)) {
        return true;
      }
    }
    return false;
  });

const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

const diffFor = (base) => {
  if (base === null) {
    return git("diff", "--cached", "-U0", "--diff-filter=ACMR", "--", ...SOURCE_GLOBS);
  }
  const from = git("merge-base", base, "HEAD").trim();
  return git("diff", "-U0", "--diff-filter=ACMR", from, "HEAD", "--", ...SOURCE_GLOBS);
};

const lint = (files) => {
  try {
    return execFileSync("node_modules/.bin/oxlint", ["-c", CONFIG, "--format", "json", ...files], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    return error.stdout;
  }
};

const main = () => {
  const baseAt = process.argv.indexOf("--base");
  const base = baseAt === -1 ? null : process.argv[baseAt + 1];
  const added = addedLinesOf(diffFor(base));
  if (added.size === 0) {
    return;
  }
  const { diagnostics } = JSON.parse(lint([...added.keys()]));
  const found = onAddedLines(diagnostics, added);
  for (const diagnostic of found) {
    console.error(`${diagnostic.filename}:${diagnostic.labels[0].span.line}  ${diagnostic.code}  ${diagnostic.message}`);
  }
  if (found.length > 0) {
    console.error(
      `\n${found.length} problem(s) on lines this change adds or edits. Older lines are left as they are (docs/conventions/lint-and-format.md).`,
    );
    process.exitCode = 1;
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
