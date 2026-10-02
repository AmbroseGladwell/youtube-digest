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
| The extension's id fixed by the store's key, and its origin derived from it | `key` in `apps/extension/manifest.json`, `scripts/extensionId.mjs`, `task deploy:extension:id` |
| The extension built knowing its server, with Settings still able to say otherwise | `apps/extension/src/productionApiUrl.ts`, `DefaultApiUrlContext` in `app-core` |
| One version number for every build, from the root `package.json`, shown at the foot of Settings | `version` in `package.json`, `task version:bump`, `scripts/buildStamp.mjs`, `define` and the manifest plugin in each app's `vite.config.ts`, `BuildLine` in `app-core`, `BUILD_COMMIT` in the `Dockerfile` |
| Two zips, named by that version: the store's with the key stripped, and a keyed one that loads unpacked, both read back | `scripts/packExtension.mjs`, `task deploy:extension`, the `build (extension)` job |
| The first deploy of each version tagged `v<version>`, with a release holding that commit's zips | the `deploy` job's last two steps, `scripts/verifyRelease.mjs` |

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

The job needs one secret to deploy, `FLY_API_TOKEN`, a deploy token scoped to this app and nothing
else, made and stored without it ever appearing on screen:

```
fly tokens create deploy --name github-actions --expiry 8760h | gh secret set FLY_API_TOKEN
```

Two more, `POSTHOG_CLI_API_KEY` and `POSTHOG_CLI_PROJECT_ID`, let the image and the
extension's build upload their source maps to PostHog. Without them, both builds delete the
maps and deploy anyway (`docs/architecture/errors-and-logs.md`, "Source maps").

`FLY_API_TOKEN` is the one production value that lives outside Bitwarden, because GitHub's runners can
only read GitHub's secrets; `docs/conventions/secrets.md` records the exception. Rotate it
by running the same line again and revoking the old token with `fly tokens list` and
`fly tokens revoke`.

Migrations run when the new process starts, under the advisory lock, so a deploy is also
a schema upgrade and needs no separate step.

One step does run before the new machines start: `fly.toml`'s `release_command`,
`seedVoiceSamples`, which applies the migrations itself and renders any voice sample that is
missing, so the Settings picker has one per voice (`docs/features/narration-voice.md`, "The
samples"). It never fails the deploy; its last log line says how many samples are ready and
which voices are missing.

What to verify afterwards, because a deploy that logged success is not one that was
looked at:

- `task deploy:status` shows one machine, started or stopped, and a passing check.
- `https://theoverviewapp.com/api/handshake` answers with the floor and the version.
- The root serves the web app, and Settings can ask for a magic link that arrives.
- The release step's `voice samples ready` line says 15 of 15, and
  `https://theoverviewapp.com/api/audio/samples` lists them.
- The `log shipping` startup line names PostHog, and the deploy's lines show up in
  PostHog's Logs (`docs/architecture/errors-and-logs.md`, "Turning it on").
- Settings shows the version and commit that were merged, and if the version was new,
  the repo has a `v<version>` release with the extension's zip attached.

## The extension

The extension is not deployed. It is uploaded to the Chrome Web Store once per version,
and three things had to be settled for that to be a mechanical step: which id it has,
which server it talks to, and what number it carries.

**Its id is the store's to give.** Chrome derives an extension's id from its public key,
and an unpacked build with no key in its manifest gets one derived from the directory it
was loaded from, which is why every worktree has had a different origin and
`CORS_ALLOWED_ORIGINS` has lived in `.env.local`. One id everywhere means the store's key
in the manifest, and the store hands that over only after a first upload: a new item whose
manifest already carries a `key` is refused with "key field is not allowed in manifest",
because the store assigns the id itself. So the order is fixed. Upload a draft once,
without publishing; on the item's Package tab, View public key; paste its body into
`apps/extension/manifest.json` as `key`, one line, header and footer removed. From
then on every unpacked build in every checkout has the store's id, `task
deploy:extension:id` prints the origin from it, and that origin goes in two places,
`fly.toml`'s `CORS_ALLOWED_ORIGINS` and `.env.tpl`'s, replacing the per-checkout value.
The zip that goes back to the store has the key stripped again, since the store refuses it
on a new item and needs it on no upload; `scripts/packExtension.mjs` does that and reads
the zip back to check. A library made under the old unpacked id does not follow the new
one, because it is a different origin; that is the free tier's shape, and sync is how a
library moves.

**So there are two zips, and the keyed one is the one to load.** The store's needs and a
person's are opposite: the store refuses a manifest with a key, and a build loaded
unpacked *without* one gets an id derived from the directory it sits in, which the API
does not vouch for. That build reaches sign-in, fails the CORS preflight, and says
"Couldn't reach the server. Check the address and try again." — with nothing wrong with
the address. Until the listing is live, unpacked is the only way to install the extension,
so a pack makes both from the same `dist`: `the-overview-<version>.zip` for the store, and
`the-overview-<version>-unpacked.zip`, the same build with the key kept, to load at
`chrome://extensions`. Both go on the release. A tree whose manifest has no key yet packs
the store's zip alone and says so, which is the shape the bootstrap below starts in.

**It knows its server.** `PRODUCTION_API_URL` in `apps/extension/src/productionApiUrl.ts`
is what the panel's Settings shows as the server address before anything is typed, and it
is `APP_URL`: one origin serves the web app, the API and the sign-in page. The field
stays, because a build loaded unpacked against a local API has to be able to say
`http://localhost:3000`, and what is typed wins. Three lines carry the address and move
together: `APP_URL` in `fly.toml`, the deploy job's URL in `ci.yml`, and this constant, and
all three name `theoverviewapp.com`.

**The version.** There is one number, `version` in the root `package.json`, and every
build of both shells carries it: the web app in its bundle, the extension in its bundle
and in its manifest, which is emitted by a plugin in `apps/extension/vite.config.ts` from
`apps/extension/manifest.json` with that version written in, rather than copied from
`public/` with a number of its own. Chrome reads it, the store requires it to rise on
every upload, and it names the zip. The `0.0.0` in each workspace's `package.json` is
the placeholder it has always been and means nothing; the root's is the real one, and a
build refuses to run at `0.0.0`. `task version:bump -- patch` (or `minor`, `major`) moves
it, with no tag or commit of its own: commit the bump in the PR that ships it. The web
app deploys on every merge whether or not the number moved, so two deploys can share a
version; the commit beside it is what tells them apart.

**Bumping is a decision, and nobody makes it for you.** Nothing in CI moves the number.
A merge with no bump still deploys the web app, Settings shows the new commit under the
old version, and no tag or release is made; for a web-only change that is the right
outcome and there is nothing to do. The number has to move when a zip is going to the
store, because the store refuses an upload whose version has not risen above the last
one, and the draft it holds is `0.1.0`. So the rule is: bump in the PR whose zip you
intend to upload, and otherwise leave it. Which of patch, minor or major is
`docs/conventions/versioning.md`'s. If that PR is merged without the bump, the
release the deploy makes is skipped as already tagged, and the fix is a second PR with
the bump alone.

`task deploy:extension` builds and zips into `apps/extension/release/`, and reads each zip
back before reporting: the manifest at its root, and that manifest being the one written
into it — the store's without a key, the keyed one with the store's own. CI runs the same
pack on every push and keeps both for fourteen days, so the file uploaded to the store,
and the one someone loads unpacked, can be what CI built from the merge rather than a
laptop's.

**What a build says it is.** The foot of Settings carries one line, `Version 0.1.0
(30bb95a)`, the same in the web app, the extension's page and its panel, so the two can be
checked against each other and an unpacked build against the tree it came from. The stamp
is made once by `scripts/buildStamp.mjs` and baked in by `define` in each app's
`vite.config.ts`: the version, the short commit, and whether tracked files had uncommitted
changes, which the line then says. The image has no checkout (`.dockerignore` leaves
`.git` out), so the commit goes in as the `BUILD_COMMIT` build arg: the deploy job passes
the merge's sha, and `task deploy` and `task deploy:image` pass `HEAD`. A build given
neither shows the version alone, and a shell that passes nothing shows no line at all,
rather than an empty one.

**Tags and releases.** Nothing tags by hand, and `npm version` is run with no tag or
commit of its own, because a tag here means "this deployed", not "someone bumped the
number". The `deploy` job, once the machine is healthy, looks for the tag `v<version>`
for the version it just shipped. If it is there, the deploy stays under it: the web app
deploys on every merge whether or not the number moved, and the commit beside the version
in Settings is what tells same-version deploys apart. If it is not, the job creates it on
the merge commit together with a GitHub release of the same name, notes generated from
the merged pull requests since the last tag, and the extension's zip attached. Those zips
are the ones the `build (extension)` job made from the same commit, downloaded from the
run's own artifact rather than rebuilt, and read back before the deploy starts by
`scripts/verifyRelease.mjs`: each manifest inside is at the version being tagged, the
store's carrying no key and the keyed one carrying the store's own so the origin it loads
as is the origin `CORS_ALLOWED_ORIGINS` names, and `build.json` beside it, emitted by the
same plugin as the manifest, names that version, the short form of the commit being
deployed, and a clean tree. Anything else fails the job before Fly is touched. So the file to upload to the store is the one on the
release, and the store's number, the tag, the manifest and the bundle all agree. A
`task deploy` from a laptop tags nothing; it is the escape hatch, not a release.

**Once, by hand**, to fix the id:

```
task deploy:extension                      # apps/extension/release/the-overview-0.1.0.zip
```

1. Upload the zip to the developer dashboard as a new item, and leave it as a draft.
2. Package tab, View public key, into `manifest.json` as `key`.
3. `task deploy:extension:id`, and its output into `fly.toml` and `.env.tpl` as
   `CORS_ALLOWED_ORIGINS`.
4. Commit. The next merge deploys an API that vouches for the extension's origin, and the
   next `task run:extension` in any checkout loads with the store's id.

## The TTS service

*Deployed 2026-09-30: five stopped machines.* `services/tts` has its own image (`services/tts/Dockerfile`, with
the model baked in and hash-checked) and its own Fly app, `the-overview-tts`
(`services/tts/fly.toml`), because it is a different machine size with a different life:
`performance-4x`, chosen by measurement (`docs/features/tts-pre-rendered-speech.md`,
"Measured on Fly.io").

- **A pool, not a machine.** Every machine is identical and stopped until needed. The proxy
  gives each one request at a time (`hard_limit = 1`) and starts another stopped one when all
  running ones are busy, so the pool's size is the number of renders that can run at once. A
  stopped machine costs only its image storage.
- **It stops itself.** The process exits `IDLE_EXIT_SECONDS` (15) after its last render, and
  Fly's default restart policy leaves a clean exit stopped. Health checks do not count as
  work, so they never keep a machine up.
- **Private.** The app gets a Flycast address and no public one; only the API, over Fly's
  private network, can reach it.
- **No health check, and the port opens before the model loads.** A machine that stops itself
  cannot keep passing a check, and `fly deploy` waits on one, so there is none: the proxy
  starts machines without it. The model loads in the background while the port is already
  open, so the request that woke a stopped machine waits about eight seconds for Kokoro rather
  than being refused before anything is listening.

The first deploy, when the API side exists to call it:

```
cd services/tts
fly apps create the-overview-tts
fly ips allocate-v6 --private     # Flycast: reachable as the-overview-tts.flycast
fly deploy --remote-only
fly scale count 5                 # the pool; each stays stopped until the proxy starts it
```

Its one secret is the PostHog token it reports errors under
(`docs/architecture/errors-and-logs.md`, "The TTS service"). `services/tts/.env.prod.tpl`
names it and `task deploy:tts:secrets` imports it into this app, the same way
`task deploy:secrets` does for the API.

CI builds this image on every push (the `image (tts)` job). On `main`, once everything has
passed, the `deploy (tts)` job deploys it, but only when `services/tts` differs from what is
live:

- **What's live** is read from the machines. Each deploy runs
  `fly deploy --remote-only --ha=false --env DEPLOYED_COMMIT=<sha>`, so every machine carries
  the commit it was deployed from. `scripts/ttsDeployDecision.mjs` compares that commit with
  the one being built.
- **Why not compare with the previous push.** CI cancels a run on `main` when a newer merge
  lands, so a TTS change whose run was cancelled would never deploy. Comparing with what's
  live catches it on the next run.
- **It deploys** when `services/tts` changed since the live commit, and when the machines
  carry no commit or different ones (a deploy by hand drops the stamp). **It skips**, and
  says why in the log, when nothing changed, or when the live commit is newer than this one,
  so re-running an old run never rolls the pool back.
- **It checks** by reading `DEPLOYED_COMMIT` back from every machine, stopped ones included.
  There's no health check to ask: the service is private and its machines stop themselves.

It has its own token, `FLY_TTS_API_TOKEN`, a deploy token scoped to `the-overview-tts`
alone, so neither deploy job can touch the other app:

```
fly tokens create deploy --app the-overview-tts --name github-actions-tts --expiry 8760h | gh secret set FLY_TTS_API_TOKEN
```

Without it, the job skips with a warning rather than failing `main`. Deploying by hand,
`fly deploy --remote-only --ha=false` from `services/tts`, still works. The app's one secret,
`POSTHOG_API_KEY`, stays a one-off `task deploy:tts:secrets`, because CI can't read Bitwarden.

### Deploy order

The app's `deploy` job waits for `deploy (tts)`, and goes out only if it succeeded. When
`services/tts` hasn't changed, that job skips in seconds, so the app is barely held up. When
it has, the app waits until every machine reports the new commit. Without the TTS token, the
TTS job passes with its warning and the app deploys as before.

TTS first is the safe order for the usual change: the pool learns to accept something, and
the app starts sending it. OV-69 was one: the pool started accepting an empty line (a line
shown but not spoken), which the pool before it refused. The rule that comes with the order:
**a change to `services/tts` must keep working with the app that is already live**, because
for the length of a deploy it will be. Two kinds of change can't meet that, and no order fixes
them, so they ship as two PRs:

- **The pool stops accepting something** (a stricter limit, a language dropped): first a PR
  where the app stops sending it, then the one where the pool stops accepting it.
- **The render version changes** (`RENDER_VERSION` in the service, `NARRATION_RENDER_VERSION`
  in the domain): the pool refuses any version but its own, so until both match, every render
  fails. First a PR where the pool accepts both versions, then the app's bump, then a PR that
  drops the old one.

A flag on the merge (a PR label, or a commit trailer) could choose app first for a single run,
with a second TTS job after `deploy`. It isn't built: the only change it would serve is the
first kind above, which is safer as two PRs anyway, because the old app is live during any
deploy.

Narration is kept in the private R2 bucket `the-overview-audio`, in Cloudflare account
`781691f32a5cf03b132121e499f510a4`, through a token scoped to that bucket only.
`.env.prod.tpl` carries its two keys, which `task deploy:secrets` imports; `fly.toml`'s `[env]`
names the pool, the account and the bucket, which is what turns narration on.

## What this does not do

- **Hold a deploy for approval.** A merge to `main` deploys without a pause. GitHub's
  `production` environment can require a reviewer with one setting, if that is ever
  wanted; the job already runs under that environment so the switch is in the repository
  settings, not in the workflow.
- **List the extension.** The mechanics above end at a zip and an id. The listing itself
  needs a privacy policy the web app does not yet serve, a justification for each
  permission the manifest asks for, screenshots and the store copy. The draft upload that
  fixes the id has been made, so `CORS_ALLOWED_ORIGINS` in `fly.toml` names the store's
  origin and production vouches for a build carrying the key — the keyed zip on each
  release, or any local `task run:extension`. Nothing is installable from the store until
  the listing is written.
- **Sweep expired rows.** Sessions, magic links and codes are ignored when expired rather
  than deleted; the cron that would delete them has nowhere to run yet, and this machine
  stopping when idle is not it.
