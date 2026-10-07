# Docs

Five folders, five different questions.

## `prototype/` — why the original build is the way it is

- `decisions.md` — why the product and the pipeline work the way they do. Read this before changing anything.
- `constraints.md` — what was hit and what it cost. The first half outlives the prototype; the second half is environment-specific.
- `open-questions.md` — unresolved, with the evidence attached.

## `architecture/` — the real build's system-level architecture

- `architecture-options.md` — the models considered for a real build, and the trade-offs between them.
- `v1-architecture-decisions.md` — what was actually decided: the free/paid split, the stack, hosting, data layer, and the monorepo layout.
- `tiers.md` — what signed-out, free, BYO Plus and Plus readers can do: generation on our
  key within a quota counted by the server, own-key overviews counted on a free account,
  every feature free and volume paid for, the table of limits, what an own-key overview
  costs us, price guidance, how the trial is counted, and
  what the reader sees at the limit.
- `api.md` — the Fastify service itself: its shape, how a caller is identified, the two
  version numbers on the wire, the one error envelope, configuration, and how to run it.
- `analytics.md` — what a reader did, counted: analytics, logging and audit records told
  apart, why events go through our own API to PostHog, who is counted and what an event may
  carry, why only reader actions are events and everything else is a log, the overview and topic
  ids an event may carry, typing counted once it settles, the shared page counted without an
  account, adding one, the client's queue, and turning it on.
- `errors-and-logs.md` — what went wrong for a reader: `POST /api/errors` beside events, with
  or without an account, what an error may carry and how its message is redacted twice,
  source maps uploaded from each build and never served, the server's own 500s and crashes
  and the TTS service's reported beside them, the failing call's request id, the reporter
  both shells mount (what it catches, the trail of recent actions, its own queue sent before
  events), a database that won't open before the app mounts, the extension's service worker
  and the session copy it reads, shipping the server's logs over OTLP to PostHog (or
  anywhere the `OTEL_*` variables name), the Slack alerts for new, reopened and spiking
  issues, what a log line may carry, and how to find a failure's server lines by request id.
- `server-side-transcripts.md` — the ladder's last rung, our own server fetching captions:
  the YouTube-ToS position, why there is a residential proxy and which one (Decodo, behind
  one URL), direct first and the proxy only on a bot check, transcripts as part of an
  overview behind a per-caller daily safety cap that counts only what was stored, the global
  proxy budget, both kept in Postgres, a server fetch going into the shared cache confirmed,
  the client rung and readiness, logs and spend, and turning it on.
- `deploy.md` — the API serving the web app, the one image, the one Fly machine beside
  Neon, secrets piped from Bitwarden, what a deploy does and what to check after, the TTS
  pool deployed from CI only when it changed, and how the extension gets its id, its server
  and its store zip.

## `conventions/` — how code gets written here, day to day

- `frontend-architecture-guide.md` — routing, state, and query conventions for the frontend, written for this project's real stack.
- `frontend-testing-guide.md` — the testing conventions built on top of that stack.
- `naming-conventions.md` — file and folder naming, authoritative for this repo.
- `backend-testing-guide.md` — the API's two test kinds, the in-process Postgres they run
  against, and the helpers that stand in for page objects.
- `tts-testing-guide.md` — the Python TTS service's two test kinds, split by whether they
  need the Kokoro model, and how CI caches the model rather than skipping them.
- `commenting.md` — near-zero comments, and how that differs from the general baseline in `reference/`.
- `local-dev.md` — the Nix dev shell and the Task menu: how to run the stack and the
  suites locally, and which Taskfile conventions are used and why.
- `versioning.md` — the one semver number for people, the two integer versions for
  machines it must not be confused with, what patch, minor and major mean before `1.0.0`,
  and when a bump is needed at all.
- `secrets.md` — the secret manager is the only place a value exists: the committed
  template and the one command that renders it, `run --` for one-off commands, the
  gitleaks hook, the Claude Code guard and what it honestly covers, and which parts of
  the larger pattern were left out for one person.

## `features/` — feature-specific design, one file per feature

- `overview-generation-decisions.md` — the overview format's prompt composability, verdict-scale, novelty-retrieval, and topic decisions, with the reasoning.
- `novelty-scale.md` — the verdict's three novelty levels and the What stands out line:
  judged against the field rather than the reader's library, what the basis sentence
  admits, and how overviews and shares from the old scale were carried over.
- `overview-redesign.md` — what the editorial redesign changed, what it deliberately left out, and where the build departs from the design file.
- `stone-theme.md` — the stone reskin: two oranges and what each is for, three pills, the raised tile, the hero's own field, and what the design file draws that was left out.
- `chapters.md` — the reader's third tab: chapters as a structural prompt section timed
  from the transcript, why the model names a segment and never a time, what a range does
  on each surface, and how a chapter opens the transcript at its start.
- `dubious-reasons.md` — why a note is dubious: the claims behind the flag, each with
  its basis, a reason and its moment in the video; the flag derived from them, notes from
  before saying so, and the panel the flag opens under the byline.
- `audio-player.md` — the reader's bar playing narration: one player in the app shell,
  asking whether narration exists without making any, every state the design draws, the
  pacer marked as the pacer, the mini-player, iOS and the lock screen, and the Plus prompt
  it retired.
- `mcp-connector.md` — connecting Claude and other assistants to a reader's account: the
  OAuth 2.1 server beside magic-link sign-in, why an assistant's tokens are never sessions,
  the plan checked on every request, rotating refresh tokens, the three slices, the read
  and write scopes, and the one tool that writes, marking overviews read or favourite.
- `narration-voice.md` — choosing the voice notes are narrated in: the shortlist of 15, one
  sample of the same passage per voice made on deploy and cleared 30 days after it is
  superseded, the choice saved on pick, and older notes that keep their voice until
  re-recorded.
- `playlists.md` — following a public or unlisted YouTube playlist by pasting its link: what
  a paste field does with each kind of link, reading a playlist through our server and
  telling a private one from a missing one, the preview and its estimate counted in code,
  followed playlists synced and what each device has seen kept on it, checking on opening,
  Settings › YouTube playlists, unfollowing, and the From line an overview keeps.
- `capture-queue.md` — the videos waiting on this device to become overviews: made one at a
  time, oldest first, while the app is open; the library's queue group, the queue page and
  the strip's seven states; what needs attention and why; waiting without a key; and
  waiting at a limit, with the reason and resume time and no dead Try again.
- `one-overview-per-video.md` — an account holds one overview per video, everywhere: the
  server refusing a second and naming the first, the generated `video_id` column and its
  unique index, the one-off fold of duplicates run inside the migration, the merge rules
  the server and both clients share, the client folding its losing copy after pulling the
  winner, and the dialog not generating a video the library already holds.
- `capture-reason.md` — the optional "why you saved it": asked for while the overview is
  being made rather than before, read back as one line above the premise, edited in place
  from the ⋯ menu, and why the prompt never sees it.
- `error-state.md` — design turn 19's one dead-end screen: the six cases it serves, why the
  way out is the caller's to name rather than a fixed pair, and where the build departs from
  the design file.
- `extension-panel.md` — why the side panel is one video rather than a small library:
  the layout seam, its three screens, what it drops, and what `Open in web app` waits for.
- `following-playback.md` — how the transcript follows the video, what now touches the
  YouTube page and how little, and why the follow scroll is the one movement that isn't
  eased.
- `injected-button.md` — the Overview button in YouTube's own action row: why it wears
  their pill, where each of its four states gets its facts, and the three-document
  conversation behind it.
- `library-view.md` — the list opens on unread or as the reader left it, per account and
  device: saved views, URL wins, Reset and Show all, caught up, and the reader stepping
  through the same view.
- `library-sort.md` — the sort pill's three orders and why verdict isn't one, where a
  record with no date or title lands, why the order is in the URL but isn't a filter, and
  what doesn't follow it yet.
- `sharing.md` — sharing an overview with a link: why it is a snapshot rather than a live
  view, what a shared copy carries and what it never does, why the server rebuilds the copy
  rather than trusting the client's, the link that stays stopped once stopped, why Fastify
  writes the document and the app renders it, the card image drawn per request and measured
  by the renderer that draws it, how a visitor hears the copy's own narration without an
  account, and the intent that survives making one.
- `tag-reuse.md` — one tag vocabulary per library: the model offered the reader's 60 most used
  tags, spelling and singular or plural folded in code onto tags that exist, aliases for merged
  and deleted tags kept in Settings, merges that rewrite the notes, and the one-off re-tag.
- `time-saved.md` — the running total of time saved by reading instead of watching: how it
  is counted and what it leaves out, the rolling figure and its breakdown, the "Saved you"
  moment, and the ten milestones with the rules for when each shows, stored on the account.
- `settings.md` — Settings as a short list of sections: which sections exist and when each
  is hidden, the value each row shows, two panes on a wide screen and a list then a page on
  a phone or in the panel, and where new sections go.
- `plus-upsell.md` — the three places Plus is sold, why the plan is a local placeholder,
  and why Settings has no upgrade button.
- `reading-position.md` — the transcript tab opening where you had got to, per video:
  why it remembers a block's time rather than a scroll offset, why it lives in
  `localStorage`, and how a restored position takes precedence over the player.
- `record-migrations.md` — the versioned-record design that replaces reading stored records
  unvalidated: two version numbers doing two jobs, why migration happens on read rather than
  in the upgrade transaction, and why an unreadable record is quarantined rather than dropped.
  Built, apart from the screens that need a server to fire them.
- `shared-transcript-cache.md` — the first rung of transcript retrieval: read by anyone,
  added to only by accounts through their notes, served only once two accounts fetched
  the same words, who-fetched-what kept apart for a year, why the background prefetch
  never asks it, and how a bad copy is removed.
- `sync-api.md` — the server half of the sync engine: one table over every kind, the four
  numbers on a row and who owns each, why a merge migrates first, tombstones, and the feed.
- `sync-client.md` — the client half: the outbox written in the same transaction as each
  write and why it carries the change rather than the record, enrolment, one cycle's order,
  which refusals stop it and which park one write, pending writes rebased over a pull, and
  the three screens.
- `account-libraries.md` — each account's library on the device: a database per account
  beside the no-account one, why the app swaps libraries in place and never syncs the one
  being left, sign-out that syncs first, never blocks and says what it couldn't send, what
  signed out looks like (the strips, the empty library, opening, Settings), the move on
  sign-in (one overview per video, the account's copy kept, finished by running again) and
  what it tells the reader, sign-out and the move counted, and installs already signed in.
- `analytics-consent.md` — asking a reader without an account to share usage: the three
  tiers, the prompt in the strip slot and what outranks it, the consent record and the
  anonymous id kept only after a yes and dropped at sign-in, asking again when what is
  counted grows, and what of OV-62 is not built yet.
- `sign-in.md` — magic-link sign-in: why the link is spent by a POST from the page and
  carries its token in the fragment, the cookie the web app gets and the code the
  extension exchanges for its bearer, why the tab that opened an extension link stays
  signed out, and the mailer with the log behind it in development.
- `sync-metadata.md` — the one field every synced record carries so that it can say when it
  last changed: why a date is insurance rather than mechanism, why it is the only piece that
  cannot be backfilled, which three numbers a synced record ends up carrying and which of them
  the server owns, and why transcripts are the store that gets none.
- `topic-filing.md` — how topics get made and assigned: the rail's New topic modal, and the
  single overview's topic editor.
- `transcript-retrieval.md` — why retrieval is a ladder of sources rather than a provider,
  what each rung costs, how a failure decides whether the next one is worth asking, and
  what `generated` actually means.
- `transcript-storage.md` — why a transcript is keyed by video rather than by note, how its
  captions are merged into readable blocks, and what the reader's tab does with the timings.
- `tts-pre-rendered-speech.md` — a designed and measured feature that was not built.
- `watching-detection.md` — how the side panel learns which video is in front of it, why it
  offers that link rather than filling it in over the top of yours, and where the line
  between fetching captions automatically and writing an overview on request sits.

## `reference/` — external background material, not all of it specific to this repo

Brought in from elsewhere rather than written for this project. Read each file's
own framing before treating it as a rule: some is generic and immediately
usable (`accessibility-checklist.md`, everything under `ai/`), and where a file
under `coding-conventions/` conflicted with a decision already made here
(state management, file layout), it's been trimmed to only what's still
relevant and points back to the doc that actually governs this repo.
