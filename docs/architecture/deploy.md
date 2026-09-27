# Deploying

One image, one Fly.io machine, a Neon database, and the secrets it needs piped in from
Bitwarden. `docs/architecture/v1-architecture-decisions.md` chose each of those and said
why; this is how they fit together and what a deploy actually does.

**What is built, and where:**

| The decision | Where it lives |
|---|---|
| The API serves the built web app outside `/api` | `apps/api/src/http/webAppPlugin.ts`, `STATIC_ROOT` in `loadConfig.ts` |
| One image: build everything, then run only the API and its runtime dependencies | `Dockerfile`, `.dockerignore` |
| One machine in London that stops when idle, checked on `/api/health` | `fly.toml` |
| Secrets from the `overview-prod` Bitwarden project straight into Fly, touching no file | `.env.prod.tpl`, `scripts/secrets.sh fly-import`, `task deploy:secrets` |
| The menu | `Taskfiles/Taskfile-deploy.yml` |
| CI proves the image builds on every push | the `image` job in `.github/workflows/ci.yml` |

## The API serves the web app

`v1-architecture-decisions.md` put the SPA and the API on one origin so that the
magic-link session cookie needs no cross-site reasoning, and until now that was only true
in development, where Vite's proxy stood in for it. `webAppPlugin` makes it true in
production: with `STATIC_ROOT` set, `@fastify/static` serves that directory at the root,
and anything it does not hold that is a `GET` outside `/api` and `/assets/` gets
`index.html`, which is how `/sign-in` and every other router-owned address opens.

Two cache rules, and they come from `docs/features/record-migrations.md`'s "How stale a
client can actually get": the hashed files under `/assets/` are `immutable` for a year,
and `index.html` is `no-cache`, so every reload revalidates it. A tab that kept a stale
`index.html` would point at bundles the last deploy deleted, and that case is closed
twice over: a missing `/assets/` file is a `404`, never the index served in a script's
clothing. The web client's whole update story is "one reload", and this is what keeps it
so.

Without `STATIC_ROOT` the service is the API alone and says so at startup, which is how
the tests run it and how it would run behind a separate static host if that day came.

## The image

A two-stage `Dockerfile` at the repo root, because the build needs the whole workspace.
The first stage runs `npm ci`, builds the library packages, the web app and the API. The
second copies every workspace's `package.json` so the lockfile still describes a tree npm
recognises, installs only the API's production dependencies with `--omit=dev
--workspace apps/api`, and copies in the four things the process needs at runtime: the
domain package's `dist`, the API's `dist` and `migrations`, and the web app's `dist`.
Nothing from the extension, the docs, the prototype or the samples reaches the image;
`.dockerignore` keeps them, and every `node_modules` and `dist`, out of the build context.

The process runs as `node`, not root, on port 3000, with `STATIC_ROOT` baked in so the
image serves the web app wherever it runs. CI builds the image on every push and never
pushes it anywhere; it exists to prove the `Dockerfile` still works, which a `Dockerfile`
nobody builds until deploy day does not.

## The machine

`fly.toml` is the shape the architecture doc settled: one `shared-cpu-1x` machine with
256MB, in `lhr` to sit beside the Neon project's London region, `auto_stop_machines`
and `auto_start_machines` so idle time costs nothing, `min_machines_running = 0`, and
no volume, since Postgres is on Neon and the API keeps nothing on disk. `force_https`
means `APP_URL` is https, which `loadConfig` insists on whenever real mail is sent.

The health check is `GET /api/health`, which runs `select 1` against the database, so a
machine that starts but cannot reach Neon is unhealthy rather than up.

`APP_URL` is the domain below, and the app name is the one line to edit if the Fly app is
called something else. Everything that is not a secret lives in `[env]` here, in the
repository, where a change to it is a diff: the mail transport, the sender, the floor, the
session length.

## Secrets

`docs/conventions/secrets.md` anticipated this: "the same shape is one more template and
one task". `.env.prod.tpl` names the two secrets production needs, `DATABASE_URL` and
`BREVO_API_KEY`, as placeholders, and `task deploy:secrets` renders it under `bws run`
against the `overview-prod` project and pipes the lines into `fly secrets import`.
`renderEnv.mjs` learnt to write to stdout for exactly this, so the rendered values pass
through a pipe and nowhere else: no file, no terminal, no dashboard. Fly stores them
encrypted and restarts the machine with them in its environment.

The production database string is the direct one Neon shows, not the pooled one: the API
opens a small pool of its own and applies migrations on startup, and a pooler in front
of that buys nothing here.

## The domain

The app is `https://theoverviewapp.com`. Fly holds the certificate, issued by Let's Encrypt
after `fly certs add theoverviewapp.com` and `fly certs add www.theoverviewapp.com`, and
Cloudflare holds the DNS: an `A` and an `AAAA` record at the apex pointing at the
addresses `fly ips list` shows, and `www` as a `CNAME` to the apex. The records are DNS
only, not proxied: Fly already terminates TLS and redirects HTTP to HTTPS, and a second
proxy in front would add a TLS hop, get in the way of certificate issuance, and buy one
small app nothing. `fly certs check theoverviewapp.com` says whether the certificate is
issued.

`APP_URL` is the domain, and that is not cosmetic: every magic link opens `/sign-in` at
`APP_URL`, and the session cookie is set for that origin, so a link that opened the
`fly.dev` hostname would sign a different origin in. The `fly.dev` hostname keeps answering
as a second address; nothing points at it.

`MAIL_FROM` sends from the same domain, and Brevo wants it verified for deliverability:
SPF and DKIM records, which Brevo's Senders and Domains page prints, go in the same
Cloudflare zone.

## A first deploy, and every one after

Once, on the machine doing the deploy, from the dev shell:

```
fly auth login
fly apps create the-overview-app            # or edit fly.toml and APP_URL to the name Fly allows
task deploy:secrets                         # DATABASE_URL and BREVO_API_KEY, from Bitwarden
task deploy
```

After that, **a merge to `main` is a deploy.** The `deploy` job at the end of the CI
workflow runs only on a push to `main` and only once every other job has passed, and it
runs the same `flyctl deploy --remote-only` a person would, then asks `/api/health` and
fails the job if the answer is not a 200. Deploys queue rather than cancel one another,
so two merges in quick succession roll out in order, each waiting for the previous
machine to come up healthy. GitHub records each one under the `production` environment
with the app's URL. `task deploy` still works from a laptop, for a rollback or a hotfix
while CI is red for an unrelated reason.

The job needs one secret, `FLY_API_TOKEN`, a deploy token scoped to this app and nothing
else, made and stored without it ever appearing on screen:

```
fly tokens create deploy --name github-actions --expiry 8760h | gh secret set FLY_API_TOKEN
```

It is the one production value that lives outside Bitwarden, because GitHub's runners can
only read GitHub's secrets; `docs/conventions/secrets.md` records the exception. Rotate it
by running the same line again and revoking the old token with `fly tokens list` and
`fly tokens revoke`.

Migrations run when the new process starts, under the advisory lock, so a deploy is also
a schema upgrade and needs no separate step.

What to verify afterwards, because a deploy that logged success is not one that was
looked at:

- `task deploy:status` shows one machine, started or stopped, and a passing check.
- `https://theoverviewapp.com/api/handshake` answers with the floor and the version.
- The root serves the web app, and Settings can ask for a magic link that arrives.

## What this does not do

- **Hold a deploy for approval.** A merge to `main` deploys without a pause. GitHub's
  `production` environment can require a reviewer with one setting, if that is ever
  wanted; the job already runs under that environment so the switch is in the repository
  settings, not in the workflow.
- **Reach the extension.** Production's `CORS_ALLOWED_ORIGINS` needs the extension's
  published id, which waits on the Web Store listing. Until then the web app is the whole
  product in production, and that is a complete one.
- **Sweep expired rows.** Sessions, magic links and codes are ignored when expired rather
  than deleted; the cron that would delete them has nowhere to run yet, and this machine
  stopping when idle is not it.
