# Video Digest

Turns the short-form videos you save and never watch into structured notes you can read in ninety seconds, listen to on a commute, and actually act on.

## The problem

Saving a video feels like learning something. It isn't. The saved list grows, the videos stay unwatched, and the few you do watch turn out to be eight minutes of hook and story wrapped around thirty seconds of substance. Meanwhile the thing you genuinely wanted, the one idea worth trying this week, never makes it out of the app and into your actual life.

Existing read-later tools treat this as a storage problem. It isn't a storage problem. It's a triage problem: most saved content is not worth your time, and you can't tell which until after you've spent it.

## What it does

1. You save a video the way you already do, from the share sheet on your phone.
2. It fetches the transcript and writes a structured note: what the video actually claims, the substance with the padding stripped out, a blunt verdict on whether it was worth anything, and one to three things you could do about it in the next week.
3. Notes are filed by topic and land in a library you can search, filter, read, or have read aloud to you with the text highlighting as it goes.

The output is deliberately not a summary. A summary is shorter content. This produces a judgment.

## The note format

Every note has the same shape, which is what makes a hundred of them scannable:

| Section | Purpose |
|---|---|
| In one line | What the video *is*, so you can recognise it later. Format, length, territory. Not what it argues. |
| Core claim | The single assertion. If it asserts nothing and is pure vibes, it says so. |
| Key points | Three to five bullets, substance only. Hook, story, restatement and call to action removed. |
| Verdict | One of five ratings, plus blunt reasoning. |
| Selling | Anything the creator is pitching: a course, a supplement, an affiliate link, their own app. Recorded even when it doesn't change the verdict, because the pattern across many notes is the signal. |
| Try this | One to three concrete actions for the next seven days, or an honest "nothing actionable". |
| Watch it anyway? | Yes or no, defaulting to no. |

## Verdicts

`NOVEL` · `SOLID BUT FAMILIAR` · `RECYCLED` · `THIN` · `DUBIOUS`

The scale exists to be unflattering. Most short-form content is a repackaging of standard advice, and saying so plainly is the most useful thing the tool can tell you. Contradicting mainstream evidence, or advice that conveniently requires something the creator sells, gets flagged.

## Design principles

These are the opinionated calls. They are what makes it useful rather than another summariser.

**Default to not watching.** The "watch it anyway?" answer defaults to no. Yes is reserved for cases where the visual *is* the claim: a physical technique you would perform wrong from a written description, a demonstration whose outcome is the evidence. It is not enough that seeing it would be nicer. Every soft yes costs the reader ten minutes they will not get back.

**Be blunt.** A tool that tells you everything you saved was insightful is worthless. The verdict distribution across a real library should be unflattering, and if it isn't, the tool is broken.

**Surface the pattern, not just the item.** Counting how often you save the same claim, and how often the advice comes attached to something being sold, tells you more about your own saving habits than any individual note does.

**Reading and listening are the same content.** The note is generated once and rendered both ways, with the spoken version highlighting sentence by sentence so you can follow along. Listening while doing something else is the realistic use case, not a bonus feature.

**Actions expire.** "Try this" is scoped to the next seven days and phrased concretely. Not "prioritise connection" but a specific thing, on a specific evening, with a specific person.

## Open questions

The question the first version exists to answer: **does reading the summary actually satisfy the urge, or do you still feel the pull to watch the video?** If it's the latter, the premise is wrong and no amount of polish fixes it.

Secondary, and unresolved:

- **Cost scales with users times videos.** Unlike a summarise-once-distribute-to-many product, personalised notes have to be generated per person even when two people save the same video. Dropping personalisation would allow caching a shared summary per video, at the cost of the thing that makes "Try this" worth reading. This is the central product tension and it is not yet resolved.
- **Does the verdict get trusted?** A rating is only useful if the reader believes it enough to skip things on its say-so.
- **Do the actions get done?** Generating a good suggestion is easy to verify. Whether it changes behaviour is not.

## Known constraints

- **Captions only.** Notes are generated from the transcript. No captions, no note. Audio transcription would widen coverage considerably and is the obvious next capability.
- **YouTube first.** Instagram, TikTok and Facebook are where a lot of this content actually lives, and they are harder to reach.
- **Transcript retrieval is the fragile link.** It fails intermittently on videos that do have captions, so retries and a queue that survives partial failure are not optional.
- **The pipeline must be resumable.** Any run can be interrupted. Each video is processed and committed completely before the next one starts, so an interrupted run leaves finished work saved and unfinished work untouched, rather than a half-written batch.

## Status

Prototype in daily use by one person. The capture path, transcript retrieval, note generation, topic filing and the reading and listening library all work. The measurable early result is less time spent watching videos to learn from them, and learnings that are easier to bring into a conversation and turn into action.

## Getting set up

Two tools go onto the machine by hand. Everything else — Node 22, Postgres 17, Task, `bws`, `gitleaks`, `flyctl`, `jq` — comes out of the Nix dev shell at the versions CI uses, and installing any of them yourself only gives you a second, different copy.

**Nix, with flakes enabled.** The [Determinate Systems installer](https://install.determinate.systems) turns flakes on for you. With the official installer, add `experimental-features = nix-command flakes` to `~/.config/nix/nix.conf` afterwards.

**direnv, hooked into your shell.** Install it however you install things (`brew install direnv`), then add the hook line to your shell's rc file — `eval "$(direnv hook zsh)"` — and open a new terminal. Without the hook direnv is installed but never runs, and the repo will look like it has no tools at all.

Then, once, in the checkout:

```
direnv allow     # from now on, cd into the repo is enough
task install     # npm ci exactly as CI runs it, and git pointed at .githooks
```

The first `direnv allow` builds the dev shell and takes a while: `bws` is marked unfree, so no binary cache carries it and it compiles from Rust source. That happens once per machine.

From here, `task` on its own prints the menu with a description per entry, and `task search -- db` filters it. Every command below is in there.

### The environment file

The API reads the gitignored `.env` at the repo root, rendered from the committed `.env.tpl`.

With a Bitwarden machine access token for the `overview-dev` project, `task secrets:login` stores it in your login keychain and `task secrets` renders the file. That is the supported path, and `docs/conventions/secrets.md` is the whole of it.

Without one you can still run everything. The only secret in the template is `BREVO_API_KEY`, and the API requires it only when `MAIL_TRANSPORT` is `brevo`, so render the file with a throwaway value:

```
BREVO_API_KEY=unused node scripts/renderEnv.mjs .env.tpl .env
```

Leave `MAIL_TRANSPORT=log`, which prints each sign-in link to the API's output instead of mailing it. Per-machine values that are not secrets go in `.env.local`, read after `.env`. Never hand-edit `.env` itself: the next render replaces it whole.

### Running it

```
task build:packages     # the library packages; every app and suite resolves @overview/* through dist
task run                # Postgres on :5433, the API on :3000, the web app on :5173
```

The database is created under `.local/pg` on the first run with trust authentication, so nothing needs a password. `task db:stop` stops it, `task db:psql` opens it, and `task clean` deletes it along with every build output.

To sign in, ask for a link from Settings and follow the one printed in the API's output, or skip the mail entirely with `task session -- you@example.com`.

The extension is a separate build: `task run:extension`, then load `apps/extension/dist` unpacked at `chrome://extensions`. Its panel is filled in with the production server; type `http://localhost:3000` over it.

### Checking it works

```
task typecheck
task test
```

`task test` ends with the browser suite, which needs Chromium once: `npx playwright install --with-deps chromium`. It is the one tool outside the dev shell, because the npm package fetches it into your own cache exactly as CI does.

When a task stops you, read its message rather than the failure: they are written to name the command to run next.

### Where to go next

- `docs/conventions/local-dev.md` — the dev shell and the Task menu in full, and why they are built this way.
- `docs/README.md` — an index of every doc, folder by folder.
- `docs/conventions/` — naming, commenting, and the frontend and backend guides. Read them before adding a file, folder or pattern.
- `CLAUDE.md` — how work is tracked: every branch and pull request carries a card number from the Trello backlog.

Optionally, if you work through Claude Code, attaching the Trello connector lets a session create and update cards on the backlog itself, which is otherwise a hand step in Trello before the branch can be named. Nothing needs it: the connector is a convenience, and the workflow that moves a card to Done on merge runs on its own repository secrets either way.
