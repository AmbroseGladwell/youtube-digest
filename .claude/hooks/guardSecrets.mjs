import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

// A defence against accident, not against an adversarial interpreter sharing the shell: a
// tool call that would print a secret into the model's context is refused. The list of
// files and names comes from the templates, so it needs no upkeep
// (docs/conventions/secrets.md).

const ALWAYS_GENERATED = [".env", ".env.local"];
const ALWAYS_SECRET = ["BWS_ACCESS_TOKEN"];

const SAFE_WITH_FILE = new Set([
  "ls", "rm", "mv", "cp", "test", "[", "[[", "stat", "chmod", "chown", "touch", "wc", "file", "du",
  "git", "task", "npm", "npx", "node", "source", ".", "export", "dirname", "basename", "realpath",
  "readlink", "mkdir", "bws", "echo", "gitleaks", "scripts/secrets.sh",
]);
const PRINTERS = new Set([
  "echo", "printf", "cat", "head", "tail", "less", "more", "grep", "egrep", "fgrep", "rg", "awk",
  "sed", "cut", "tr", "sort", "uniq", "strings", "xxd", "hexdump", "od", "jq", "yq", "base64", "tee",
]);
const DUMPERS = new Set(["env", "printenv", "set", "declare", "export"]);
const PREFIXES = new Set(["sudo", "command", "exec", "time", "nohup"]);

export function harvest(projectDir) {
  let templates = [];
  try {
    templates = execFileSync("git", ["ls-files", "*.tpl", "**/*.tpl"], { cwd: projectDir, encoding: "utf8" })
      .split("\n")
      .filter((line) => line !== "");
  } catch {
    templates = [];
  }
  const generatedFiles = new Set(ALWAYS_GENERATED);
  const secretNames = new Set(ALWAYS_SECRET);
  for (const template of templates) {
    generatedFiles.add(basename(template).replace(/\.tpl$/, ""));
    let text = "";
    try {
      text = readFileSync(join(projectDir, template), "utf8");
    } catch {
      continue;
    }
    for (const match of text.matchAll(/\$\{([A-Z][A-Z0-9_]*)\}/g)) secretNames.add(match[1]);
  }
  return { generatedFiles: [...generatedFiles], secretNames: [...secretNames] };
}

const unquote = (token) => token.replace(/^['"]|['"]$/g, "");

// Whitespace splits tokens only outside quotes, so a quoted sentence that happens to name
// a file is one string literal and not a path.
function splitTokens(stage) {
  const tokens = [];
  let current = "";
  let quote = null;
  for (const char of stage) {
    if (quote !== null) {
      current += char;
      if (char === quote) quote = null;
    } else if (char === "'" || char === '"') {
      quote = char;
      current += char;
    } else if (/\s/.test(char)) {
      if (current !== "") tokens.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current !== "") tokens.push(current);
  return tokens;
}

function stageTokens(stage) {
  const tokens = splitTokens(stage);
  const comment = tokens.findIndex((token) => token.startsWith("#"));
  if (comment !== -1) tokens.splice(comment);
  while (tokens.length > 0 && PREFIXES.has(tokens[0])) tokens.shift();
  while (tokens.length > 0 && /^[A-Z_][A-Z0-9_]*=/.test(tokens[0])) tokens.shift();
  return tokens;
}

function mentionsGeneratedFile(tokens, generatedFiles) {
  for (let i = 1; i < tokens.length; i++) {
    const previous = tokens[i - 1];
    const token = unquote(tokens[i]);
    if (previous === ">" || previous === ">>" || token.startsWith("--env-file") || /\s/.test(token)) continue;
    const name = basename(token.replace(/^[<>]+/, ""));
    if (generatedFiles.includes(name)) return name;
  }
  return null;
}

function mentionsSecretName(tokens, secretNames) {
  const text = tokens.join(" ");
  for (const name of secretNames) {
    if (text.includes(`$${name}`) || text.includes(`\${${name}`) || tokens.includes(name)) return name;
  }
  return null;
}

// set -euo pipefail sets options; set alone lists every variable. The same for export and
// declare, which dump only with -p.
function dumpsEnvironment(first, rest) {
  if (first === "env" || first === "printenv" || first === "set") return rest.length === 0;
  if (first === "export" || first === "declare") return rest.length === 1 && rest[0] === "-p";
  return false;
}

function decideStage(stage, { generatedFiles, secretNames }) {
  const tokens = stageTokens(stage);
  if (tokens.length === 0) return null;
  const [command, ...rest] = tokens;
  const first = basename(unquote(command).replace(/^[`'"]+/, ""));
  const file = mentionsGeneratedFile(tokens, generatedFiles);
  if (file !== null) {
    const inPlaceSed = first === "sed" && rest.some((token) => /^-[a-zA-Z]*i/.test(token));
    const counts = consumesWithoutPrinting(tokens, false);
    if (!SAFE_WITH_FILE.has(first) && !SAFE_WITH_FILE.has(unquote(command)) && !inPlaceSed && !counts) {
      return `${first} would print ${file}, a generated secrets file, into the conversation. Pipe it into another process, or read the template it was rendered from.`;
    }
  }
  if (first === "bws" && rest[0] === "secret" && (rest[1] === "get" || rest[1] === "list")) {
    return "bws secret get/list prints secret values. Pipe it through jq to select the keys, or use task secrets:run.";
  }
  if (dumpsEnvironment(first, rest)) {
    return `${first} would print every environment variable, secrets included, into the conversation.`;
  }
  const name = mentionsSecretName(tokens, secretNames);
  if (name !== null && (PRINTERS.has(first) || DUMPERS.has(first))) {
    return `${first} would print ${name} into the conversation.`;
  }
  return null;
}

// Splits a command line into pipelines and each pipeline into stages, at separators that
// are outside quotes: a semicolon inside a string is text, not a second command.
export function pipelines(command) {
  const result = [];
  let stages = [];
  let current = "";
  let quote = null;
  const endStage = () => {
    stages.push(current);
    current = "";
  };
  const endPipeline = () => {
    endStage();
    result.push(stages);
    stages = [];
  };
  for (let i = 0; i < command.length; i++) {
    const char = command[i];
    const next = command[i + 1];
    if (quote !== null) {
      current += char;
      if (char === "\\" && quote === '"' && next !== undefined) current += command[++i];
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      current += char;
    } else if (char === "\\" && next !== undefined) {
      current += char + command[++i];
    } else if (char === "\n" || char === ";") {
      endPipeline();
    } else if ((char === "&" && next === "&") || (char === "|" && next === "|")) {
      endPipeline();
      i++;
    } else if (char === "|") {
      endStage();
    } else {
      current += char;
    }
  }
  endPipeline();
  return result;
}

export function decide({ toolName, toolInput }, harvested) {
  if (toolName === "Read") {
    const name = basename(String(toolInput?.file_path ?? ""));
    if (harvested.generatedFiles.includes(name)) {
      return `${name} is a generated secrets file; read the template it was rendered from instead.`;
    }
    return null;
  }
  if (toolName !== "Bash") return null;
  for (const stages of pipelines(String(toolInput?.command ?? ""))) {
    const last = stages[stages.length - 1];
    const reason = decideStage(last, harvested);
    if (reason !== null) return reason;
    const upstream = stages.slice(0, -1).map(stageTokens);
    const file = upstream.map((tokens) => mentionsGeneratedFile(tokens, harvested.generatedFiles)).find((name) => name !== null);
    const values = upstream.some(printsBwsValues);
    if ((file !== undefined || values) && !consumesWithoutPrinting(stageTokens(last), values)) {
      const what = file ?? "secret values";
      return `That pipeline reads ${what} and still ends in a command whose output reaches the conversation. End it in wc, a checksum, grep -c, or for bws a jq that selects keys.`;
    }
  }
  return null;
}

// What a pipeline that has touched a secret may end in: something that answers a
// question about the text without repeating it. The first version of this guard allowed
// any pipe at all, and a head into cut put part of a key into the conversation.
const SINKS = new Set(["wc", "sha256sum", "shasum", "md5", "md5sum", "cmp", "true", "test", "["]);

function printsBwsValues(tokens) {
  const [command, ...rest] = tokens;
  if (command === undefined) return false;
  return basename(unquote(command)) === "bws" && rest[0] === "secret" && (rest[1] === "get" || rest[1] === "list");
}

function consumesWithoutPrinting(tokens, fromBws) {
  const [command, ...rest] = tokens;
  if (command === undefined) return false;
  const first = basename(unquote(command).replace(/^[`'"]+/, ""));
  if (SINKS.has(first)) return true;
  if (first === "grep") return rest.some((token) => /^-[a-zA-Z]*[cql]/.test(token));
  if (first === "jq" && fromBws) {
    const program = rest.join(" ");
    return /\.(key|id|name)\b/.test(program) && !program.includes("value");
  }
  return false;
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  let input = "";
  try {
    input = readFileSync(0, "utf8");
    const call = JSON.parse(input);
    const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
    const reason = decide({ toolName: call.tool_name, toolInput: call.tool_input }, harvest(projectDir));
    if (reason !== null) {
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
            permissionDecisionReason: reason,
          },
        }),
      );
    }
  } catch (error) {
    process.stderr.write(`guardSecrets: ${error instanceof Error ? error.message : String(error)}\n`);
  }
}
