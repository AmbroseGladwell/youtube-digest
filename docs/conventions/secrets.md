# Secrets

**The secret manager is the only place a secret value exists.** The repository stores
references, never values, and every mechanism here is either a way to turn a reference
into a value at the last moment or a guard against a value coming to rest somewhere it
can be read later. This is the pattern of a larger team's setup, cut down to what one
person on one laptop with three worktrees actually needs, and this document says which
parts were left out and why.

**What is built, and where:**

| The decision | Where it lives |
|---|---|
| The store: Bitwarden Secrets Manager, one project per environment | `overview-dev` now; `overview-prod` when there is a deploy |
| The committed template, `${NAME}` per secret | `.env.tpl` |
| One command renders it to the gitignored `.env` | `task secrets`, `scripts/secrets.sh`, `scripts/renderEnv.mjs` |
| Per-machine values that are not secrets | `.env.local`, read after `.env` by the API's scripts |
| One-off commands get values injected and nothing written | `task secrets:run -- <cmd>`, `scripts/sanityCheck.env` |
| The one long-lived secret on the machine, in the login keychain | `task secrets:login`, `.envrc` |
| A commit that stages a secret value is refused | `.githooks/pre-commit`, gitleaks with its default rules plus a Brevo key rule in `.gitleaks.toml` |
| A tool call that would print a secret into Claude's context is refused | `.claude/settings.json`, `.claude/hooks/guardSecrets.mjs` |
| The tools, from the dev shell | `flake.nix`: `bws`, `gitleaks`, `jq` |

## Why Bitwarden Secrets Manager

The only password manager on this machine belongs to an employer, and a personal
project's secrets do not go into an account someone else administers. Bitwarden's
Secrets Manager has a free tier that covers this project many times over, a web UI, a
CLI that injects secrets into a child process by key name, and machine access tokens
scoped to named projects. The two other candidates were a paid 1Password plan, refused
for the reason above, and SOPS with an age key, which would have needed no account at
all and was the simpler choice for one laptop; Bitwarden won on having a UI and working
from a second machine without moving a key file.

## How a value gets where it is needed

**Locally.** `.env.tpl` is committed and holds `${NAME}` where a secret goes. `task
secrets` runs the render under `bws run`, which puts every secret in the project into the
environment of one child process, and that process writes `.env` with the placeholders
filled. A placeholder the project does not carry refuses the whole render rather than
writing a file with a hole in it. The rendered file is mode 600 and says at its top which
template it came from. Everything the API's scripts read comes from `.env`, and after it
from `.env.local`, which is where a value that differs per checkout and is not a secret
goes: the extension's origin for CORS, derived from the path the unpacked build was
loaded from, so different in every worktree until the store's key fixes it
(`docs/architecture/deploy.md`).

**For one command.** `task secrets:run -- npx tsx scripts/endToEndSanityCheck.ts` runs
the command with the project's secrets in its environment and writes nothing.
`scripts/sanityCheck.env` lists which keys those scripts read, for the reader; `bws run`
injects the whole project regardless.

**The token.** `bws` needs a machine access token, made in Bitwarden's web UI and scoped
to the projects it may read. `task secrets:login` stores it in the macOS login keychain
under `overview-bws`, and `.envrc` exports it as `BWS_ACCESS_TOKEN` on entering the dev
shell, so no file on disk holds it. On another platform, export the variable however
that platform keeps secrets; `.envrc` leaves an existing value alone. The account is on
Bitwarden's EU server, and `bws` talks to the US one unless told, answering
`invalid_client` as if the token were wrong; `.envrc` exports `BWS_SERVER_URL` for that
too. When the token expires, make a new one, then `task secrets:login` and `direnv reload`.

**Deployed.** The same shape, one more template and one task: `.env.prod.tpl` names the
secrets production needs, and `task deploy:secrets` renders it under `bws run` against
`overview-prod` and pipes the lines straight into `fly secrets import`, so no value is
written to a file, typed into a terminal or pasted into a dashboard
(`docs/architecture/deploy.md`). Everything that is not a secret lives in `fly.toml`'s
`[env]`, in the repository. One value has to live outside Bitwarden: the Fly deploy token
the CI deploy job uses, which is a GitHub Actions secret because GitHub's runners can read
nothing else. It is piped from `fly tokens create` into `gh secret set` without appearing
on screen (`docs/architecture/deploy.md`).

## Projects are the environment boundary

One Bitwarden project per environment, `overview-dev` and later `overview-prod`, with
separate credentials in each: a separate Brevo key, a separate database. A token scoped
to `overview-dev` cannot read production, which is the whole of the value when the same
laptop can reach both, and separate credentials cost nothing now and are painful to
introduce later. Keys are named exactly as the environment variable they become,
`BREVO_API_KEY`, because `bws run` injects by key and a second naming layer would be a
second thing to get wrong.

## Adding a secret

1. Create it in the right project in Bitwarden, keyed as the variable name.
2. Add `NAME=${NAME}` to `.env.tpl`, or the name to `scripts/sanityCheck.env` if only a
   one-off command reads it.
3. `task secrets`. Commit the template. Nothing else moves.

To migrate from a hand-written `.env`, `task secrets:seed` creates the project if it is
missing and copies each templated key's value out of the existing file into it, once,
skipping keys that are already there. The value passes through the CLI's arguments for
the length of one call, which is why it is a one-time migration and not the way to add
things afterwards.

## The guards, and what each honestly covers

**gitleaks in pre-commit.** `task install` points git at `.githooks`, and the hook scans
what is staged, nothing else. It catches a value pasted into the wrong file, which is
the accident the other guards cannot see. `--no-verify` bypasses it, as it must, and the
history was scanned once when the hook was added and was clean.

**The Claude Code guard.** A `PreToolUse` hook on `Bash` and `Read` refuses a call that
would print a secret into the model's context: reading a rendered file, printing one
with a command whose output reaches the conversation, `bws secret get` and `list`
unpiped, a bare `env`, `printenv`, `set`, `export -p` or `declare -p`, or a printing
command that names a secret variable. Its lists come from the templates, so a new
template or placeholder is guarded with no upkeep: the rendered files are the tracked
`*.tpl` names with the suffix removed, plus `.env` and `.env.local` always, and the
names are every `${NAME}` in them plus `BWS_ACCESS_TOKEN`. A pipeline that touches a
rendered file or `bws secret` output may end only in a sink that repeats nothing: `wc`, a
checksum, `grep -c` or `-q`, or for `bws` a `jq` that selects keys. The pattern this copies
allowed any pipe at all, on the reasoning that piped output goes to another process, and
the first day of this guard showed why that is not enough: a `head` into `cut` put part of
a key into the conversation. What remains is a defence against accident, not against an
interpreter sharing the shell that wants the value. It fails open with a line on stderr if
it cannot run, because a guard that cannot run should not also take every shell command
with it.
`.claude/hooks/guardSecrets.test.mjs` is the list of what it refuses and what it lets
through, and `npm run test:tooling` runs it in CI.

**The rule behind both is about outcome, not tooling**: a secret value must never
appear in the model's token stream. Rendering to a file the model does not read and
injecting into a child process are fine; anything that prints a value is not. That
framing is why `bws run` is allowed and `bws secret get` is refused, and it applies to
tools nobody has named yet.

## What was left out, and why

- **The checksum beacon, its CI validator and the pre-commit pairing rule.** They tell
  teammates their rendered secrets are stale and police that a template change ships
  with its checksum. With one person, staleness is fixed by re-running `task secrets`,
  and the checksum is a committed file that would move on every rotation for no reader.
- **The naming linter.** One rule, key equals variable name, held in the head.
- **A secret-manager token in CI.** CI runs against PGlite and calls no external
  service, so it holds no secret at all. That is worth keeping; the first job that
  genuinely needs a value is the moment to add a scoped token, and not before.
- **A Kubernetes operator path.** Fly has no equivalent and needs none.
- **The desktop notification before a prompt.** There is no biometric prompt: the token
  is read from the keychain without one.

## Gotchas

- **The first dev shell after this change compiles `bws` from source**, several minutes
  of Rust, because nixpkgs marks it unfree and the binary cache carries no unfree
  builds. `flake.nix` allows exactly that one package through. It is built once per
  machine and cached in the Nix store after that.
- **`task secrets` overwrites `.env` whole.** A hand edit there survives until the next
  render and never reaches anyone. Templates and `.env.local` are the places to edit.
- **The seed reads `.env`, so run it before the first render**, or the render's refusal
  will name the keys the project is missing and the hand-written values will still be
  in `.env` to seed from.
- **The keychain token is per user, the project is per token.** A token scoped to
  `overview-dev` will render locally and refuse a production project by design.
- **The guard splits on newlines and pipes, not on shell grammar.** A heredoc body that
  contains a line like `cat .env` is refused as if it were a command. Write such prose
  with the Write tool rather than through a shell.
