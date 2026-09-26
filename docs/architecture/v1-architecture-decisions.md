# v1 architecture decisions, and what produced them

`docs/architecture/architecture-options.md` explored six models (A–F) and left nine open
decisions in its §11, plus a 17-item "Ideas" list that hadn't been reconciled with
any of them. This file records what was actually decided, in a working session, and
why — in the same spirit as `docs/prototype/decisions.md`: a decision, stated plainly, with the
reasoning that produced it, not a spec.

## The model

**One codebase, not two products, for free and paid.** They differ only in which
backend a shared `OverviewStore`/`AudioStore`-style interface talks to
(architecture-options.md §10). This was chosen over building free and paid as
separate builds because upgrading a user from free to paid should be a data
migration, not a different app.

**Free tier is fully local.** BYO LLM key, local storage, no account, no server
contact, no cost to us. This isn't a crippled version of the product — it's the
degraded state the product already believes in: `docs/prototype/decisions.md` says "anything
optional hides rather than degrades," and local-only *is* what that looks like when
there's no authenticated session.

**Paid tier requires an account** — but the reasoning matters: auth exists to gate
*writes to shared infrastructure*, not as a feature wall in its own right. Anyone
contributing to the shared transcript cache, syncing a digest, or queuing a phone
capture needs to be an attributable identity so we can rate-limit and clean up after
abuse. It has nothing to do with whether they're paying. What *is* paid-gated is the
infrastructure itself: cross-device sync, the shared transcript cache, phone capture
via the share-sheet PWA queue, and TTS. Anything that inherently needs a server is
naturally paid-only, because free users never talk to one.

**The extension is not one of those things, and this line originally said it was.** It
listed "the extension UX-parity features" among the paid-gated infrastructure, which was
wrong by the paragraph's own test: a BYO-key extension contacts no server of ours, so
there is nothing for an account to gate. Corrected on 2026-09-18, when `apps/extension`
was built: the extension is free-tier, BYO-key, and its library is local to the
extension origin. It is also where the paid tier is now *described* — the side panel is
the surface that hits both of the things Plus buys, so that is where the three prompts
live (`docs/features/plus-upsell.md`). Describing them changes nothing here: generation
in the extension stays BYO-key and free.

**Two local libraries is the free tier's honest shape, not a gap to be closed.** Browser
storage is partitioned by origin, so `chrome-extension://<id>` and the web app's origin
cannot open the same IndexedDB — `docs/architecture/architecture-options.md` §5 has the
mechanics. A free user with both surfaces has two libraries. The `externally_connectable`
bridge that would merge them (§5 row 2) was considered and rejected: it makes the web app
inert in any browser without the extension installed, which is a worse story than telling
the user plainly that these are two libraries until an account syncs them. Both surfaces
say so on screen — the Settings page and the empty-library hero.

What is rejected there is the bridge as *the mechanism for merging the libraries*, and
that still stands. It is not a ban on the API: `docs/features/transcript-retrieval.md`
plans to use `externally_connectable` to let the web app borrow the extension's YouTube
access as **one rung of four**, where a missing extension costs money rather than
function and nothing goes inert. Different use, different verdict — noted here because
the next reader will otherwise find this paragraph and think it was overruled quietly.

**Generation stays BYO-key at every tier, for now.** We never hold an LLM provider
key or run generation ourselves, at either tier. This is an explicit, revisitable
choice, not a permanent stance — but it means the users×videos cost tension
described in `docs/prototype/open-questions.md` #2 is not our problem for v1. If a future paid
tier ever offers managed generation (no key required), that tension becomes real and
the hybrid the doc floats — cache the objective analysis once, personalise only the
actions/topic cheaply per user — stops being optional.

**Transcript retrieval stays client-fetched, contributed to the shared cache, via
Supadata, BYO-key.** Server-side retrieval (with its accompanying YouTube-ToS
exposure) is a deliberate v1 deferral, not a rejection — it's the natural next step
once the shared-cache path is proven, not a day-one requirement. Supadata specifically,
not left generic, because its `mode=native` call is YouTube's own caption-track
transcript at a flat 1 credit/video regardless of length — the prototype's actual
usage (~30 videos) would sit comfortably inside its free 100-credits/month tier — and,
critically, that native transcript arrives with per-segment start/duration timing
already attached (it's YouTube's own caption timing, not something Supadata
computes). Its ASR fallback (`mode=generate`, used only when a video has no captions
at all) is priced per minute instead, 2 credits/minute — the number that would matter
if audio-transcription coverage (README's "obvious next capability") is ever built on
top of the same provider, not the flat native rate.

This directly resolves `docs/prototype/open-questions.md` #3, not just narrows it: that question
concluded video runtime was unrecoverable server-side because "the transcript source
exposes no duration and its timestamps are client-side only" — true of whatever
source the prototype had access to, not a property of transcript sources in general.
With Supadata's native timing, runtime is the actual video duration, not a
word-count estimate with the doc's own ±25% caveat. One thing this doesn't retroactively
fix: existing prototype notes have no such timing and can't get it without a
Supadata re-fetch of their source video, per the same doc's own note that "existing
notes cannot be backfilled without re-fetching every transcript."

**Amended on 2026-09-20: the part that changed is "via Supadata".** This paragraph was
written when there was one client, so "client-fetched" meant the same thing in both of
them. It does not. The extension holds `host_permissions` on `youtube.com`, which is a
standing exemption from the same-origin policy; the web app holds nothing of the kind and
cannot read YouTube at all — `youtubei/v1/player`, `timedtext` and `/oembed` all answer a
cross-origin request from an arbitrary page with no `Access-Control-Allow-Origin` header.
That was checked, not assumed, and it is the constraint the replacement hangs off.

So retrieval is now a **ladder** — the shared cache, then the user's own extension, then a
BYO Supadata key, then a server — with the extension fetching YouTube's caption track
itself and Supadata kept as an opt-in rung rather than as the source. The reasoning is in
`docs/features/transcript-retrieval.md`.

What this paragraph got right is why the ladder can exist at all, and none of it is
withdrawn: it was Supadata's native mode that proved a flat-rate transcript carrying
YouTube's own per-segment timing was obtainable, and that timing is the same timing
whichever rung supplies it. `docs/prototype/open-questions.md` #3 stays resolved.

**One claim here was wrong, and it is the kind this project cares most about.** This
section says Supadata's native timing makes runtime "the actual video duration, not a
word-count estimate". Measured against the video in `mapMetadataToVideoSource.test.ts`,
Supadata's `duration` of 2127.2s is *exactly* where that video's last caption cue ends —
while YouTube's own `lengthSeconds` is 2132. Supadata derives duration from the caption
track. It is not the video's length, and it errs in both directions: measured gaps across
five real videos ran from 13.8s short to 1.5s long. A caption-derived figure presented as
runtime is precisely what `docs/prototype/constraints.md` exists to forbid, so the move off
Supadata does not only make retrieval free, it **corrects a measurement**.

The server-side deferral below still stands, and nothing built since is server-side. What
changed is why it is deferred: the extension removed the urgency for its own users, and
the web app — which cannot fetch at all — is now the named reason a server will eventually
be needed, rather than cost.

It also changes what a partial "Watch it anyway?" can carry — see
`docs/features/overview-generation-decisions.md`'s Watch-it-anyway section — from a purely
qualitative pointer ("the fractal-folding section") to an actual `{start_ms, end_ms}`
range, which is closer to the "suggested timestamp ranges" idea deferred below than
that deferral assumed when it was written.

## v1 feature scope

**In scope:** core note generation and library (verdicts, key points, actions,
read/listen); the paid sync + transcript-cache path; Chrome-extension UX parity with
the reference repo — auto-grabbing the transcript on a YouTube page, an injected
digest button, following playback in the transcript view, opening the extension
panel to the side.

**Deferred, not abandoned:** MCP server access to summaries and transcripts;
per-video-type content templates (recipe steps, process instructions, a
subjectivity/bullshit rating for commentary); suggested timestamp ranges for a
partial "watch it anyway" — deferred as a UX decision (see
`docs/features/overview-generation-decisions.md`), not because the timing data is unavailable,
now that the transcript source carries YouTube's own per-segment timing; ads on any surface.

## Answers to architecture-options.md §11

| # | Question | Answer |
|---|---|---|
| 1 | Confirm v1 = Model D | Yes, in the free/paid split described above — Model D's server shape is what the paid tier is. |
| 2 | Keys per-device or synced | Per-device. Generate on the device with a key, listen anywhere. We never hold a provider secret. |
| 3 | Store audio server-side or regenerate | Store it, keyed by a hash of the spoken script — Kokoro now runs server-side (see below), so regenerating per-play would mean re-running CPU synthesis on every listen for content that never changes. |
| 4 | Transcript source | A ladder — the shared cache, then the user's own extension, then a BYO Supadata key, then a server. Still client-fetched and contributed to the shared cache. Amended 2026-09-20, see `docs/features/transcript-retrieval.md`. |
| 5 | TTS provider | Self-hosted Kokoro, per `docs/features/tts-pre-rendered-speech.md` — see Technology stack. |
| 6 | Headless queue draining | Not required for v1. The capture queue drains next time a keyed device opens; no background worker needed. |
| 7 | Browser support | Chrome/Edge only for v1. |
| 8 | Auth method | Email magic-link. |
| 9 | Personalisation vs. cost tension | Personalisation is kept, and the tension doesn't apply to us, because generation stays BYO-key (see above). |

## New decisions, from reconciling the Ideas section

**No ads anywhere in v1.** Ads inside the Chrome extension are impossible regardless
of any product decision: Manifest V3 blocks the remotely-hosted scripts ad networks
require. Web-app-only ads were considered and dropped too, for lack of usage data to
justify them yet — revisit once the product has real free-tier traffic.

**LLM generation is Claude-only for v1, behind a provider interface.** Multi-provider
BYO (Idea 1: Claude/ChatGPT/DeepSeek with model selection) is real future work, but
`docs/prototype/decisions.md` already flags that the prototype's markdown-parsing approach is
fragile ("the parser cannot distinguish a label from a sentence that opens with the
same word") and that a real build should get structured fields from the generation
step itself. That fix needs building once, correctly, before it's multiplied across
providers with different structured-output mechanisms — and model behaviour around
committing to a blunt verdict (the whole point of the product, per the README) is
itself something to prove on one provider before assuming it holds across several.

**Audio format: AAC in an M4A container.** The only format with genuinely native
decode support — no shim, no polyfill — across iOS Safari, desktop Safari, and
Chrome on desktop and Android. MP3 has equivalent compatibility but is the largest of
the three at the doc's own measured sizes. Opus is smaller but its Safari support
depends on a CAF/MP4 wrapper rather than the more common Ogg/WebM, so a single encode
isn't safely universal across this listener base without extra work.

**Audio backfill: proactive for new notes, lazy for old ones.** New paid-tier notes
get audio rendered as part of the normal generation pipeline, since the pipeline is
already running and the extra ~90s of CPU is cheap to absorb there. Existing notes
get audio rendered lazily, one at a time, the first time a user presses play — with a
visible "preparing audio" loading state for that one-time wait. No bulk batch job (no
compute spent on notes nobody plays), and no Web-Speech-then-swap fallback (simpler,
at the cost of one slow first listen per old note, which only ever happens once).

**Auth: email magic-link, with OAuth added later for MCP.** Magic-link avoids
password hashing, reset flows, and login-attempt rate-limiting entirely, at the cost
of needing transactional email either way. When MCP support is built (currently
deferred), it will need an OAuth 2.1 authorization layer on top — that's the standard
access model MCP clients expect for a chat app to connect to a user's account — but
that composes cleanly on top of magic-link accounts as an additive layer, so nothing
about today's auth choice needs to be reworked when that day comes.

**API keys stay in `localStorage` until the first content script exists.**
`architecture-options.md` §6 puts provider keys in `chrome.storage.local` with
`setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" })`, and the reason it gives is keeping
them out of a content script. `apps/extension`'s first slice declares none, so as of
2026-09-18 that rule defends against nothing while costing a real rework: `chrome.storage`
is async and `useApiKeys` reads its snapshot synchronously through `useSyncExternalStore`.
`localStorage` on the extension origin is already per-device and never syncs, which is the
property the key actually needs. The trigger for migrating is named rather than left to
memory: the slice that declares the first content script, or the first time a key is read
outside a document. `readApiKeys(storage: Storage = globalThis.localStorage)` already takes
the storage as an argument, so the shell is where that change lands.

**Naming is parked.** "YouTube Digest" is taken (Idea 15); no replacement chosen yet.

## Technology stack

**One shared app core, not a Next.js web app plus a separate extension.** The stack
started as Next.js (web + API) with a separate Vite/React extension sharing only
components and types. That changed once a direct question — why would the extension
and the web app use different routers at all — exposed that Next.js's actual
strengths (SSR, streaming, SEO) don't apply here: the web app's primary surface is an
authenticated personal library, not crawlable content. Dropping Next.js unlocks a
deeper reuse story: **Vite + React + React Router + TanStack Query + SCSS Modules**
as one shared `app-core` package, mounted verbatim by both the Chrome extension (in
its side panel / full-page context) and the web app (a static-hosted SPA) — the same
router, the same View Transitions choreography, the same query/mutation layer, mostly
the same page components, not just shared components and types. If a public
marketing/pricing page is ever needed, it can be a small separate static page rather
than a reason to bring Next.js back for the whole app.

The specific frontend conventions — persistent-shell routing, the View Transitions
gate, TanStack Query patterns (hierarchical keys, optimistic mutations, skeletons not
spinners), and client-state tiers — are recorded in
`docs/conventions/frontend-architecture-guide.md`. The testing conventions built on top of that
stack are recorded in `docs/conventions/frontend-testing-guide.md`.

**API: Fastify (Node/TypeScript).** Handles auth, `/overviews`, `/captures`, `/audio` —
the thin sync server from Model D. It also serves the built SPA's static assets
directly (`@fastify/static`) for everything outside `/api/*`, so the SPA and the API
share one origin. This was chosen specifically to avoid CORS and cross-site-cookie
complexity for the magic-link session — a separate reverse proxy or subdomain split
would have needed both handled correctly for auth to work at all.

**TTS: a separate, private Python service running `kokoro-onnx`.** Kept in Python
because that's the path `docs/features/tts-pre-rendered-speech.md` actually measured — 1.65x
realtime generation, verified chunk-timing accuracy on a real note — not because
Python is a hard requirement. The prototype's use of `kokoro-onnx` over the
JavaScript `kokoro-js` was itself a Cowork-sandbox artifact (HuggingFace was blocked
by the build container's egress allowlist; GitHub releases weren't), a limitation
`docs/prototype/constraints.md` says disappears in a real build. `kokoro-js` exists as a
Node-native alternative but is unverified for this project — collapsing the TTS
service into the main Node service later is a reasonable thing to benchmark, not a
decision made now. The service runs privately, reachable only from the Fastify API
over Fly.io's internal network, never exposed publicly.

**Monorepo layout:**
```
packages/app-core/    shared Vite/React/React-Router app: routes, components,
                       queries, mutations, SCSS
apps/extension/       thin MV3 shell, mounts app-core in the side panel / full page
apps/web/             thin static-SPA shell, mounts app-core
apps/api/             Fastify — auth, overviews, captures, audio, serves apps/web's build
services/tts/         Python, kokoro-onnx, private
packages/domain/      shared OverviewStore/AudioStore interfaces, overview schema
```

**Data**: Postgres via **Neon** — serverless, scales to zero between requests, and
its free tier (0.5GB storage, 100 CU-hours, 5GB egress) is likely to cover this
project's actual v1 usage on its own, since Postgres here only ever holds metadata
and overviews, never large blobs. Object storage for audio via **Cloudflare R2** —
S3-compatible, and critically zero egress fees, which matters because audio is
fetched repeatedly on playback rather than written once.

**Hosting: Fly.io.** Two Machines: the Fastify app (a `shared-cpu-1x`/256MB machine,
configured to auto-stop when idle and auto-start on request, so idle time genuinely
costs nothing rather than just being cheap) and the private Kokoro service (a larger
shared-cpu tier to hold the model in memory, same auto-stop/auto-start pattern,
invoked only when a note actually needs audio). Both pinned to the same Fly region,
so the private traffic between them is free. No Fly Volumes needed anywhere —
Postgres is on Neon, audio is on R2, and the TTS worker's temp files during synthesis
use the machine's ephemeral local disk.

Fly.io was chosen over GKE or AWS (ECS/EKS) because the actual infrastructure need —
two small services, one private link between them, a strong preference for near-zero
idle cost, no dedicated ops person — doesn't warrant Kubernetes-level operational
overhead: writing and maintaining manifests, provisioning a VPC for the private link,
managing node pools or Cloud Run/Fargate task definitions. Both GKE and AWS remain
open later if the project grows into needing them (a platform team, compliance
certifications, multi-region requirements) — because both services are plain Docker
containers, migrating them to ECS, GKE, or Cloud Run at that point is a
redeploy-target change, not a rewrite.

No dollar total is promised anywhere in this document for either Fly.io or Neon's
real bill — both depend on traffic this project doesn't have yet. What's recorded
here is pricing *structure* and cost drivers, checked against each provider's current
pricing page during this session, not a predicted number — consistent with
`docs/prototype/constraints.md`'s rule that no figure shown to a user should be a model's
estimate dressed up as a measurement.

## Naming: the product, and why the domain type is `Overview`

**The product's working name is "The Overview" — provisional ("for now"), reached
after checking about a dozen candidates against real, live competitors.** Every
synonym for "a short version" — digest, gist, rundown, brief (six separate products
found using it), nutshell, videoDigest — turned out to already be a live product
doing roughly this exact thing, because that's the obvious word to reach for and a
lot of people have built roughly this tool. Judgment-flavoured words (Verdict, Judge,
Watchwise) came back clean instead, and eventually "Video Overview" → "The Overview"
— the definite-article technique for turning a generic phrase into a brand (The
Browser Company, The Hustle) — won on being both understandable and unclaimed.

**The domain type is `Overview` too, and that was a deliberate call made with a real
tension known, not an accident.** Three things were weighed:

- *Brand-coupling risk*: tying a domain type to a still-provisional brand name repeats
  the exact mistake `DigestStore` made — it was inherited unchanged from an early
  "Video Digest"-era interface sketch in `docs/architecture/architecture-options.md`
  §10 and never reconsidered once the naming moved past that word. Decided not to
  repeat this by choosing the domain name deliberately rather than defaulting to it.
- *Semantic clash*: "overview" is a condensed-description word, the same family as
  digest/gist/summary/brief, which sits against `docs/prototype/decisions.md`'s first
  stated principle — "a note is a judgment, not a summary." Accepted as a conscious
  trade-off, not resolved away.
- *Future collision*: a later iteration may want a literal video-overview/chapters
  feature — a structural breakdown for navigating the video itself, genuinely the
  accurate use of the word. That feature will need its own, different name when it's
  built; "Overview" is spent on the judgment record instead.

**"Note" was freed up on purpose: a future iteration is expected to let users take
their own notes on a video** (likely timestamped, similar to the reference repo's
floating note-taking panel) — genuinely different from the AI-generated record, and
worth not colliding with. The field holding the reader's own words was called
`Overview.savedNote`, and an earlier version of this paragraph claimed it "already sits on
the right side of that split by coincidence and needed no change". **That was wrong on
inspection**: it is the reader's stated reason for wanting the video overviewed at all —
context the prompt is handed, not a note taken against the video — so it was the one place
still spending the freed-up word. It is now `Overview.captureReason`, renamed through the
migration chain (`docs/features/record-migrations.md`), and "note" is genuinely free.

**One `OverviewStore` interface, backed by two collections, not one.** Overviews and
per-overview read/favourite state are exposed through the same interface but never
share a method: `saveOverview` takes a full `Overview` (no read/favourite fields
exist on that type at all) and replaces it wholesale; `setOverviewState` only ever
touches `{ read, favourite }`. The wholesale-replace-without-wiping-flags rule from
`docs/prototype/decisions.md` is enforced by the method signatures themselves, not
restated as a comment on either one.

**Topic creation is gated by which method exists, not by an instruction.** The
generation pipeline only ever needs `listTopics` (to build the match list for a
call) and `saveOverview` (to file the result) — it has no reason to ever hold a
reference to `createTopic`. Only UI code, after a suggestion is accepted, calls it.
"The model suggests, never creates" holds at the interface boundary, independent of
whatever the prompt itself says.

**`listClaims` returns a lightweight projection, not full overviews.** `{ overviewId,
title, claim }` is enough for the personal-library novelty retrieval in
`docs/features/overview-generation-decisions.md`, and keeps that decision's "flat
list for now, revisit with real evidence" stance consistent — a cheap projection is
cheaper still.

**`Settings` holds sync-eligible preferences only — the section toggles and the
reader-context personalisation text. API keys are deliberately not part of it, not
merely left out of the first pass.** Per-device key storage (above) is a permanent
property of BYO-key generation, not a v1 shortcut: a key must never sync even for a
paid, authenticated user, while `Settings` exists specifically to be the thing that
*does* sync across a user's devices. Shaping keys like just another setting would
make that boundary something every future call site has to remember, instead of
something the type can't represent.

**Every id is a branded UUID (`OverviewId`, `TopicId`), not a bare `string`.** Both
are `z.uuid().brand(...)`, in a shared `Brands.ts` — real, native support in Zod v4,
not a hand-rolled convention. The point isn't the UUID format, it's that `OverviewId`
and `TopicId` can't be swapped for each other or for a bare string, even though both
are UUIDs underneath — the compiler catches `getOverviewState(someTopicId)` the same
way it catches passing a number where a string was expected, rather than that mistake
surfacing at runtime as a query that silently returns nothing. `Brands.test.ts`
encodes this as a permanent check (`@ts-expect-error` on the two cases that must not
compile) rather than something that only held the day it was written.

**Stored records were read back unvalidated, and a versioned migration was the accepted
way out. It is now built** (`docs/features/record-migrations.md`), and what follows is the
problem it was built for, kept because it is the evidence. A record written by an older schema came back exactly as it
was written, so a field added since has no key at all: `undefined`, not `null`. Every
reader of a progressively-added field therefore has to guard on truthiness rather than on
the one absent value the current schema can express — `OverviewThumbnail` carries the long
form of this note, and `readerMetaParts` and the reader's published date both follow it.

This is tolerable only because nothing is released and the records are all our own. It has
already cost two bugs, and the two failure modes are different enough to be worth naming:
`thumbnailUrl` and `durationMs` degrade quietly (a missing image, `NaN:NaN video`), while
`publishedAt` reached `Intl.DateTimeFormat`, which throws `RangeError` on an invalid date
and took the whole page to the error boundary. A guard that is remembered is not a
guarantee, and the next added field inherits the trap.

The intended replacement is a schema version on the record with migrations between them —
v1 to v2 and so on — where each new field is either given a default as it is migrated, or
explicitly declared as one the readers may find absent. That puts the decision in one place
per field, made once, rather than at every call site forever. It is not worth building
against a handful of local dev records; it becomes worth building at the point either real
users or a synced paid tier exist, whichever is first.

That replacement is designed and built in `docs/features/record-migrations.md`, which argued
— against the trigger set here — that the backend is the thing that makes it expensive to
defer, because `schemaVersion` has to exist in the API contract and the Postgres row either
way, and that a rule about who may write to what cannot be retrofitted once two versions are
already syncing. Records now carry a `schemaVersion`, are migrated and parsed on the way out
of the store, and are quarantined and counted rather than dropped when they cannot be read.
What waits for the API is the handshake and the two screens it fires.

**Two of the stores now fill their defaults at read time, and that is a stopgap, not the
migration above.** `IndexedDbSettingsStore.get()` returned `DEFAULT_SETTINGS` only when the
record was *absent*, so a record written before `plan` and `plusNoticeDismissed` existed
came back missing both — the same trap as `publishedAt`, one layer lower, and reached by
every reader rather than one component. It now merges the stored record onto the defaults,
and `getOverviewState` does the same. Two limits were named here rather than left to be
discovered, and the migration has since closed both: the merge was shallow, so a toggle added
inside `sectionsEnabled` was still absent — the write path now merges into that nested object
instead of replacing it — and nothing was validated on the way out, so a record that was
*wrong* rather than old passed straight through. Both reads now parse, and fall back or
quarantine rather than handing back a shape nobody checked. The defaults stay where they are:
merging them is still what makes adding a top-level field a non-event, and a migration is only
needed where a default cannot express the answer.

**Every connection closes itself when another context needs to upgrade, and a blocked open
fails instead of hanging.** `indexedDB.open` fires `blocked` — not `error` — when another
connection holds the database at a lower version, and the request simply never completes.
`openLocalDatabase` had no handler for it, so the returned promise never settled: the web
app's second tab, or the extension's panel against a service worker holding a connection,
would sit on a blank page forever with nothing logged. This was latent only because
`DATABASE_VERSION` had not moved since the transcripts store; the migration above is
exactly the change that moves it, so this is a prerequisite rather than a separate cleanup.

Connections now set `onversionchange` to close themselves, which is what makes the common
case work — the upgrading context proceeds instead of waiting on a tab the user forgot. The
cost is that the closed connection's next transaction throws, so the surface holding it has
to say so; `openLocalDatabase` takes an `onSuperseded` callback for that, and **nothing
consumes it yet.** Until something does, that tab degrades invisibly, which is the habit in
`CLAUDE.md` this is meant to honour and currently doesn't. `LocalDatabaseBlockedError`
covers the other direction — the open that cannot start — and is likewise unrendered.

## Explicitly out of scope for v1

- Multi-LLM-provider BYO (Idea 1) — Claude-only behind an interface, see above.
- MCP server access (Ideas 4, 10) — deferred; its OAuth requirement is noted above so
  auth doesn't need rework when it's built.
- Per-video-type content templates (Idea 13) and suggested timestamp ranges (Idea 14).
- Ads (Ideas 5, 6) on any surface.
- Server-side transcript retrieval and its YouTube-ToS exposure.
- A headless capture-queue worker — the queue drains on next keyed-device-open.
- ~~Backend testing conventions (Fastify API, the Python TTS service)~~ — decided with the
  first backend slice: `docs/conventions/backend-testing-guide.md`. The TTS service is
  still uncovered.
- A test harness for the extension's chrome.*-API surface (content-script injection,
  auto-grab-on-tab-open) — noted as a real gap in
  `docs/conventions/frontend-testing-guide.md`'s addendum, not designed yet.
- Product naming (Idea 15).
