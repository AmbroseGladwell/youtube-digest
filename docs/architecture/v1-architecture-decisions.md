# v1 architecture decisions, and what produced them

`docs/architecture/architecture-options.md` explored six models (A–F) and left nine open
decisions in its §11, plus a 17-item "Ideas" list that hadn't been reconciled with
any of them. This file records what was actually decided, in a working session, and
why — in the same spirit as `docs/prototype/decisions.md`: a decision, stated plainly, with the
reasoning that produced it, not a spec.

## The model

**One codebase, not two products, for free and paid.** They differ only in which
backend a shared `DigestStore`/`AudioStore`-style interface talks to
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
via the share-sheet PWA queue, TTS, and the extension UX-parity features. Anything
that inherently needs a server is naturally paid-only, because free users never talk
to one.

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

It also changes what a partial "Watch it anyway?" can carry — see
`docs/features/note-generation-decisions.md`'s Watch-it-anyway section — from a purely
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
`docs/features/note-generation-decisions.md`), not because the timing data is unavailable,
now that transcript source is pinned to Supadata; ads on any surface.

## Answers to architecture-options.md §11

| # | Question | Answer |
|---|---|---|
| 1 | Confirm v1 = Model D | Yes, in the free/paid split described above — Model D's server shape is what the paid tier is. |
| 2 | Keys per-device or synced | Per-device. Generate on the device with a key, listen anywhere. We never hold a provider secret. |
| 3 | Store audio server-side or regenerate | Store it, keyed by a hash of the spoken script — Kokoro now runs server-side (see below), so regenerating per-play would mean re-running CPU synthesis on every listen for content that never changes. |
| 4 | Transcript source | Supadata, BYO-key, client-fetched, contributed to the shared cache (see above). |
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

**API: Fastify (Node/TypeScript).** Handles auth, `/digests`, `/captures`, `/audio` —
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
apps/api/             Fastify — auth, digests, captures, audio, serves apps/web's build
services/tts/         Python, kokoro-onnx, private
packages/types/       shared DigestStore/AudioStore interfaces, note schema
```

**Data**: Postgres via **Neon** — serverless, scales to zero between requests, and
its free tier (0.5GB storage, 100 CU-hours, 5GB egress) is likely to cover this
project's actual v1 usage on its own, since Postgres here only ever holds metadata
and digests, never large blobs. Object storage for audio via **Cloudflare R2** —
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

## DigestStore and Settings (packages/types)

**One `DigestStore` interface, backed by two collections, not one.** Notes and
per-note read/favourite state are exposed through the same interface but never
share a method: `saveNote` takes a full `Note` (no read/favourite fields exist on
that type at all) and replaces it wholesale; `setNoteState` only ever touches
`{ read, favourite }`. The wholesale-replace-without-wiping-flags rule from
`docs/prototype/decisions.md` is enforced by the method signatures themselves, not restated
as a comment on either one.

**Topic creation is gated by which method exists, not by an instruction.** The
generation pipeline only ever needs `listTopics` (to build the match list for a
call) and `saveNote` (to file the result) — it has no reason to ever hold a
reference to `createTopic`. Only UI code, after a suggestion is accepted, calls it.
"The model suggests, never creates" holds at the interface boundary, independent of
whatever the prompt itself says.

**`listClaims` returns a lightweight projection, not full notes.** `{ noteId, title,
claim }` is enough for the personal-library novelty retrieval in
`docs/features/note-generation-decisions.md`, and keeps that decision's "flat list for now,
revisit with real evidence" stance consistent — a cheap projection is cheaper still.

**`Settings` holds sync-eligible preferences only — the section toggles and the
reader-context personalisation text. API keys are deliberately not part of it, not
merely left out of the first pass.** Per-device key storage (above) is a permanent
property of BYO-key generation, not a v1 shortcut: a key must never sync even for a
paid, authenticated user, while `Settings` exists specifically to be the thing that
*does* sync across a user's devices. Shaping keys like just another setting would
make that boundary something every future call site has to remember, instead of
something the type can't represent.

## Explicitly out of scope for v1

- Multi-LLM-provider BYO (Idea 1) — Claude-only behind an interface, see above.
- MCP server access (Ideas 4, 10) — deferred; its OAuth requirement is noted above so
  auth doesn't need rework when it's built.
- Per-video-type content templates (Idea 13) and suggested timestamp ranges (Idea 14).
- Ads (Ideas 5, 6) on any surface.
- Server-side transcript retrieval and its YouTube-ToS exposure.
- A headless capture-queue worker — the queue drains on next keyed-device-open.
- Backend testing conventions (Fastify API, the Python TTS service) — the testing
  guide adopted this session (`docs/conventions/frontend-testing-guide.md`) is frontend-only.
- A test harness for the extension's chrome.*-API surface (content-script injection,
  auto-grab-on-tab-open) — noted as a real gap in
  `docs/conventions/frontend-testing-guide.md`'s addendum, not designed yet.
- Product naming (Idea 15).
