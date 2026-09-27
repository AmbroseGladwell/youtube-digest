# Running things locally

Two tools, one front door. The Nix dev shell provides every tool the repo is built and
run with, and Task is the menu of things to do with them. Nobody installs Node, Postgres
or Task by hand, and nobody remembers which directory a command runs from.

## The shell

`flake.nix` declares one dev shell: Node 22 (the version CI uses), Postgres 17, and
`go-task`. `.envrc` enters it through direnv and puts `node_modules/.bin` on the path.

```
direnv allow      # once, in the repo root; from then on cd is enough
```

Without direnv, `nix develop` opens the same shell. The flake's lock file pins the
nixpkgs revision, so two machines get the same tool versions.

Playwright's Chromium is the one tool outside the shell. The npm package downloads it
into the user's cache on macOS and Linux, which is what CI does too; `task iwft` checks
for it and names the install command when it is missing. Running on NixOS would need
`playwright-driver.browsers` pinned to the same Playwright version, which nobody has
needed yet.

## The menu

```
task              # the list, with a description per task
task search -- db # the list, filtered
```

The root `Taskfile.yml` is an index: the global tasks and a list of includes. The
included files are the two things anyone does here, running and testing, and an optional,
gitignored `Taskfiles/Taskfile-local.yml` for personal shortcuts.

**Running**, in the order a first day goes:

| | |
|---|---|
| `task install` | `npm ci`, as CI does |
| `task env:init` | `.env` from the example, pointed at the local Postgres |
| `task build:packages` | the library packages, in dependency order |
| `task run` | Postgres, then the API on :3000 and the web app on :5173 together |
| `task run:extension` | a build to load unpacked at `chrome://extensions` |
| `task session -- you@example.com` | a bearer token with no mail involved, if one is wanted (`docs/architecture/api.md`) |

Signing in locally needs no mail account: with the default `MAIL_TRANSPORT=log`, asking
for a link from Settings prints it to the API's output, and opening it on
`http://localhost:5173` signs that browser in. An extension link's page shows the code to
enter in the panel (`docs/features/sign-in.md`).

The panel is a different origin from the API, so for it to sync `.env` also needs
`CORS_ALLOWED_ORIGINS=chrome-extension://<id>`, with the id `chrome://extensions` shows
for the unpacked build, and the API restarted (`docs/architecture/api.md`, Origins).

The database lives under `.local/pg`, created on the first `task run:db` with trust
authentication on port 5433, so `.env`'s `DATABASE_URL` needs no password. `task db:stop`
stops it and `task db:psql` opens it; `task clean` deletes it along with every `dist`.

**Testing** mirrors CI's jobs one to one: `task test:<package>` for any library package,
`task test:api`, `task test:extension`, `task iwft`, `task typecheck`, `task build`, and
`task test` for the lot.

## The conventions that carry it

Four things from the Taskfile playbook are what make this worth having over a README of
commands, and each is used deliberately:

- **`dir:` on every task that has one**, so any task runs from anywhere in the repo.
- **`preconditions:` whose message names the next command.** `task run:api` without a
  database says `task run:db`; without `.env` it says `task env:init`; without built
  packages it says `task build:packages`, which is the stale-types failure that
  otherwise looks like a real type error.
- **`{{.CLI_ARGS}}` on every wrapper**, so `task test:api -- --test-name-pattern sync`
  and `task iwft -- sync` work without leaving the front door.
- **One wildcard, last in its file.** `test:*` covers every present and future library
  package; the specific tasks above it take precedence, which is why they are above it.

**CI does not call Task.** Every task wraps a `package.json` script or a tool call, and
the workflows call those same scripts directly. That is the shared layer: a task cannot
drift from CI because both run the script. Installing Task in CI would add a step and
buy nothing over what the scripts already guarantee.

**Fingerprinting (`sources:`/`generates:`) is deliberately not used.** `tsc` and Vite
already decide what is stale; a second cache would be a second way to be wrong.
