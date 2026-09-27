import test from "node:test";
import assert from "node:assert/strict";
import { decide } from "./guardSecrets.mjs";

const harvested = { generatedFiles: [".env", ".env.local"], secretNames: ["BWS_ACCESS_TOKEN", "BREVO_API_KEY"] };
const bash = (command) => decide({ toolName: "Bash", toolInput: { command } }, harvested);
const read = (file_path) => decide({ toolName: "Read", toolInput: { file_path } }, harvested);

test("reading a generated file is refused and reading its template is not", () => {
  assert.match(read("/repo/.env"), /generated secrets file/);
  assert.match(read("/repo/.env.local"), /generated secrets file/);
  assert.equal(read("/repo/.env.tpl"), null);
  assert.equal(read("/repo/src/loadConfig.ts"), null);
});

test("printing a generated file into the conversation is refused", () => {
  assert.match(bash("cat .env"), /would print \.env/);
  assert.match(bash("head -c 200 ../../.env"), /would print/);
  assert.match(bash("grep BREVO .env"), /would print/);
  assert.match(bash("cd apps/api && cat ../../.env"), /would print/);
  assert.match(bash("cat .env.local"), /would print/);
});

test("output that goes to another process is allowed, as the doc's pipe rule says", () => {
  assert.equal(bash("cat .env | grep -c ="), null);
  assert.equal(bash("grep '^MAIL_FROM=' .env | cut -d= -f1"), null);
});

test("handling a generated file without printing it is allowed", () => {
  assert.equal(bash("ls -la .env"), null);
  assert.equal(bash("rm .env"), null);
  assert.equal(bash("sed -i '' 's/^APP_URL=.*/APP_URL=x/' .env"), null);
  assert.equal(bash("test -f .env && echo present"), null);
  assert.equal(bash("node --env-file=../../.env dist/server.js"), null);
  assert.equal(bash("cat template > .env"), null);
  assert.equal(bash("git check-ignore .env"), null);
  assert.equal(bash("task secrets"), null);
});

test("separators inside quotes are text, not a second command", () => {
  assert.equal(bash('echo "one; never print .env" >> notes.md'), null);
  assert.equal(bash("echo 'a | b' && ls .env"), null);
  assert.equal(bash('printf "%s\\n" "x; cat .env"'), null);
  assert.match(bash('echo "quoted"; cat .env'), /would print/);
  assert.match(bash("ls .env && cat .env"), /would print/);
});

test("a comment naming a file is prose, and a quoted command word is still the command", () => {
  assert.equal(bash("task secrets   # .env rendered from .env.tpl"), null);
  assert.equal(bash("'''task secrets # .env'''"), null);
  assert.equal(bash("echo done # see .env"), null);
  assert.match(bash("cat .env # just looking"), /would print/);
});

test("a stream editor that prints rather than edits in place is refused", () => {
  assert.match(bash("sed -n '1,5p' .env"), /would print/);
});

test("dumping the environment or a secret variable is refused", () => {
  assert.match(bash("env"), /every environment variable/);
  assert.match(bash("printenv"), /every environment variable/);
  assert.match(bash("echo $BREVO_API_KEY"), /would print BREVO_API_KEY/);
  assert.match(bash('printf "%s" "${BWS_ACCESS_TOKEN}"'), /would print BWS_ACCESS_TOKEN/);
  assert.match(bash("printenv BREVO_API_KEY"), /would print BREVO_API_KEY/);
  assert.equal(bash("env | grep -c PATH"), null);
  assert.equal(bash("set -euo pipefail"), null);
  assert.equal(bash("set -u\ncd /tmp"), null);
  assert.equal(bash("declare -x FOO=1"), null);
  assert.match(bash("set"), /every environment variable/);
  assert.match(bash("export -p"), /every environment variable/);
  assert.equal(bash('[ -n "$BREVO_API_KEY" ] && echo set'), null);
});

test("bws prints values only through get and list, and those are refused unpiped", () => {
  assert.match(bash("bws secret get 1234"), /prints secret values/);
  assert.match(bash("bws secret list"), /prints secret values/);
  assert.equal(bash("bws secret list | jq -r '.[].key'"), null);
  assert.equal(bash("bws project list"), null);
  assert.equal(bash("bws run --project-id 1 -- npm test"), null);
});

test("other tools and ordinary commands pass", () => {
  assert.equal(decide({ toolName: "Edit", toolInput: { file_path: "/repo/.env" } }, harvested), null);
  assert.equal(bash("npm test --workspace apps/api"), null);
  assert.equal(bash("cat README.md"), null);
});
