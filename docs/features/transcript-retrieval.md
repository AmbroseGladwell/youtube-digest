# Where a transcript comes from

`docs/architecture/v1-architecture-decisions.md` pinned transcript retrieval to Supadata,
BYO-key, and said plainly that server-side retrieval was "a deliberate v1 deferral, not a
rejection". This is the file that reopens it. The architecture-level decision, including
the YouTube-ToS question, belongs in `docs/architecture/`; this file is how retrieval
works in the code.

## The constraint the whole design hangs off

**The web app cannot fetch a transcript at all.** `youtubei/v1/player`, `timedtext` and
`/oembed` answer a cross-origin request from an arbitrary page with no
`Access-Control-Allow-Origin` header, so the browser discards the response before any of
our code sees it. `no-cors` returns a body nothing can read. There is no header to set
and no client-side way round it.

The extension's `host_permissions` on `youtube.com` **is** an exemption from that rule,
and it is the only asset in this design that cannot be bought or rebuilt. So "client-
fetched" means two different things depending on which surface is asking, and that is why
retrieval is a ladder rather than a provider.

This is worth stating first because the rest looks over-engineered without it. If the web
app could fetch, the answer would be "do what the extension does, everywhere".

## The ladder

A source is asked only if the one before it could not answer.

| Tier | Cost to us | Who contacts YouTube |
|---|---|---|
| the shared cache | a row read | nobody |
| the user's own extension | nothing | the user, from their own IP |
| a BYO Supadata key | the user's credits | Supadata |
| our own service | a residential proxy | us |

Two properties follow, and both are the point:

- **Every rung above the last is a fetch that never happens from our IP.** The ladder is
  the exposure control, not only a cost optimisation.
- **A cold fetch happens once per video, ever.** Extension users warm the cache for web
  users who will never contribute to it, so the bill tracks the rate at which new videos
  enter the corpus rather than users times videos.

Only the Supadata rung is built today. The others are named here because the shape of the
interface is what makes them additive rather than a rewrite.

### Why the rung is one method

`resolveVideo` used to fetch metadata, ask the store whether the captions were already
held, and only then buy them. That gap exists **because Supadata bills the two halves
separately** — see `docs/features/transcript-storage.md`. A source that returns both in
one free call has no such gap and should not have to pretend it has one.

So a rung is a single `resolve()`, and the probe it needs is handed to it
(`TranscriptSourceContext.readHeldTranscript`) rather than built into the walker. The
Supadata rung still does metadata → probe → captions internally; nothing about the
credit-saving behaviour changed, and the IWFT call-count assertions that guard it did not
move.

The walker keeps the outer probe — the one that answers from the store without contacting
anything — and owns the single write-back, so a record stored before metadata was kept
completes itself no matter which rung answered (`docs/features/watching-detection.md`).

## Failure is data, not a provider's error type

Deciding whether to try the next rung used to mean asking whether an error was a
`SupadataError` with a particular string on it. A ladder cannot be built on that, so
`TranscriptFetchError` carries a named `failure` instead:

| Failure | What the ladder does |
|---|---|
| `no-captions` | try the next rung — another source may have a track this one cannot see |
| `access-restricted` | try the next rung |
| `source-blocked`, `source-unavailable`, `rate-limited`, `malformed-response` | try the next rung |
| `source-unsupported` | skip the rung entirely; it was never able to answer |
| `video-unavailable` | **stop.** No rung will do better on a video that does not exist |

`retryable` is derived from the failure rather than passed alongside it, so a caller
cannot name a failure and then contradict it.

`source-unsupported` is what a rung reports when it has nothing to offer for this request
rather than having tried and lost — no key, or a surface with no CORS exemption. The
reader should never be told about it, which is why `transcriptFailureMessage` prefers the
last rung that actually tried.

## Three bugs the port fixed, each pinned by a test

These were live, and each one either cost money or told a caller something untrue.

- **The ASR fallback threw the provider's own error.** The `mode=generate` call sat
  outside the `try` that wrapped the native one, so the contract "this rejects with a
  `TranscriptFetchError`" held for one path and not the other. Anything downstream
  branching on `instanceof` missed it.
- **A metadata failure was never wrapped at all**, so the provider's raw message reached
  the UI.
- **A retry re-submitted the whole job.** `withSingleRetry` wrapped submit *and* poll, so
  a failed status read abandoned a job that was still running and started a second one —
  a second credit, for a request that had not failed. Now only the submit is retried, and
  a transient status read is one lost tick. Status reads cost nothing, so another tick is
  free.

## What `generated` means, and why it was wrong

`StoredTranscript.generated` drives the `Machine-transcribed` label in the reader's
transcript tab. It was set from *which Supadata mode answered*: `native` meant `false`,
`generate` meant `true`.

That is not the same question. Supadata's `native` mode returns whatever caption track
exists on the platform — **including YouTube's own ASR track**. So a video whose only
captions are machine-heard succeeds on `native`, never reaches `generate`, and is stored
as though a human wrote it.

This is measurable rather than theoretical: of the four still-available videos in
`samples/`, **three have only an ASR track**. Three of the five notes this repo ships as
its reference corpus are machine-transcribed and have never carried the label that
explains why they read the way they do.

The Supadata rung cannot tell the difference — the information is not in its response.
InnerTube can: `captionTracks[].kind === "asr"` is per-track and unambiguous. So
`generated` means **"not written by a human"**, whichever rung fetched it, and the
Supadata rung is simply the one that cannot always tell. Existing rows are
wrong-but-harmless and correct themselves on a re-fetch.

## Rungs are built per resolve, never hoisted

A rung is constructed inside the `mutationFn`/`queryFn` that uses it, not memoised above
it. Caption URLs from YouTube are signed and expire within hours, so a long-lived source
holding a cached player response would eventually serve a 403 that looks exactly like
client drift. Building per resolve makes that impossible rather than unlikely.

## The InnerTube fetcher

`fetchInnerTubeTranscript` is the free path. It takes an injected `YouTubeFetch` rather
than calling `fetch` itself, so this package never imports `chrome.*` and the same code
runs in the extension worker, in Node, and under a test that intercepts the request.

**One player call serves both halves.** `POST /youtubei/v1/player` returns `videoDetails`
and the caption track list together, so the two-call shape Supadata bills for simply does
not arise. A test asserts the call count rather than trusting it.

**The clients are data, tried in order.** `DEFAULT_CAPTION_CLIENTS` is ANDROID then IOS.
They are overridable at the call, because these version strings drift and a stale one
must be fixable without shipping a release. A client that answers 400, or with a shape
the schema does not recognise, is demoted to the next one — that is what drift looks like
from the inside, and it should degrade rather than outage.

WEB is not in that list. Its caption URLs have been PO-token-gated since mid-2025 and
come back empty. It *is* used for one thing: `publishDate` lives on the microformat,
which the mobile clients do not carry and the web clients do. So `publishedAt` costs a
second call, made best-effort — a missing date is better than a guessed one, and
`VideoSource.publishedAt` is nullable for exactly this.

**Cue times are YouTube's own.** `startMs` is `tStartMs`, `endMs` is that plus the
duration YouTube gave. A cue with no duration ends where it starts — never at the next
cue's start, never at a length inferred from its words. Window definitions, rolling
appends and whitespace-only cues are dropped because they are not things anyone said.
`>>` and `[Music]` are left in, because stripping them is the reader's job.

**An empty track is not an empty video.** A 200 carrying no cues is what a gated caption
URL looks like, so it maps to `source-blocked` and moves to the next client. Genuinely
having no track maps to `no-captions` and moves to the next *rung* — the distinction is
the difference between retrying and escalating.

`scripts/innerTubeSanityCheck.ts` runs the whole path against a real video with no key
and no `.env`. It is the only thing that can catch a dead client version, so it has to be
run by a person rather than trusted to a fixture.

## Which document actually holds the privilege

`host_permissions` exempts a **service worker's** `fetch` from CORS. A content script does
not get that: it runs in the page's origin and stays bound by that origin's policy. So the
fetch lives in the worker.

That is also the better answer functionally. The worker needs no YouTube tab, so a URL
pasted into the side panel or the full page resolves the same way as the video someone is
watching, and nothing here reads the page's DOM — YouTube's markup can change without
breaking it.

`chromeYouTubeFetcher` is the panel's end and does nothing but pass the request across.
**The worker answers rather than rejecting**: a throw inside a `sendMessage` handler
reaches the caller as an opaque `lastError` with nothing in it to act on, so every handled
message gets `{ ok: true | false }`. A failure to get any reply at all is left as a throw,
which is treated as worth one retry — right, because a worker that was asleep and failed
to wake is the textbook transient.

The manifest needed no change: `https://www.youtube.com/*` and `https://m.youtube.com/*`
were already there for the tab-watching work.

### The Origin header has to be stripped, or YouTube answers 403

Chrome attaches `Origin: chrome-extension://<id>` to the worker's `POST`, and the player
endpoint answers **403** to a call carrying one. Reproduced against the live endpoint, and
it is that header alone:

| Request | |
|---|---|
| `Origin: chrome-extension://…` | **403** |
| `Origin: https://www.youtube.com` | 200 |
| no `Origin` | 200 |
| an Android user-agent, or a desktop one | no effect either way |
| a session cookie | no effect |

`Origin` is a forbidden header, so `fetch()` can neither set nor remove it. The only way
is `declarativeNetRequest`: `youTubeOriginRule` removes it, scoped twice over — to
requests this extension initiates (`initiatorDomains: [chrome.runtime.id]`) and to YouTube
(`requestDomains`). That second bound matters and has its own test: the panel's calls to
Anthropic carry the user's key, and a header rule loose enough to reach them would be a
much worse bug than the one it fixes.

The rule is installed at the worker's top level rather than in `onInstalled`, for the same
reason `setPanelBehavior` is: a rule lost to a profile restart or an update comes back,
instead of every caption fetch silently 403ing.

**Only the player `POST` was ever affected.** The caption `GET` carries no `Origin` and
tolerates one when sent. So a symptom reading "the player endpoint answered 403" is this,
and nothing to do with the caption track.

### The request is anonymous on purpose

`fetchYouTubeInWorker` sends `credentials: "omit"`, and that is load-bearing rather than
tidy. It originally sent `"include"`, on the reasoning that the user's own session could
only help — age-gated videos, say. The opposite is true: a signed-in browser sends
`SAPISID`, InnerTube then treats the call as authenticated and expects an
`Authorization: SAPISIDHASH …` header we have no way to produce, and answers **403** — for
exactly the people most likely to be using this, and only for them. The failure is
invisible to anyone testing signed out.

What this costs is what was claimed for it: age-gated and members-only videos fail with
`access-restricted`, which is what they should report anyway. What was never at stake is
the thing that actually matters — the fetch still leaves from the user's own address,
which is the whole point of doing it here.

### The allowlist is a security boundary

`fetchYouTubeInWorker` refuses any URL whose origin is not one of those two. This is not
caution. The handler is reachable by any content script on any page the extension runs in,
and without the check the extension is an open CORS proxy for **everything** in
`host_permissions` — `api.anthropic.com` included, where the user's key goes. It is the
one thing in the bridge with its own test file.

## What generation now requires

A transcript no longer has one source, so "have you pasted both keys" became the wrong
question. `useGenerationReadiness` asks the right one: an Anthropic key, **plus at least
one rung that can answer**. A shell that can reach YouTube needs no transcript key at all.

`hasRequiredApiKeys` is gone rather than redefined — it asserted "required" of something
that is now conditional, and a name that lies is worse than a rename.

One thing worth knowing if you move that call: it is a hook, and `CapturePage` returns
early. A hook below an early return changes the hook count between renders and takes the
whole panel down behind an error boundary. It belongs at the top with the others.

## The background prefetch spends nothing, structurally

The panel fetches the captions of the video in front of it before anyone asks for a note
(`docs/features/watching-detection.md`). That used to cost two Supadata credits per video
merely browsed — and the defence was that the form reported the spend afterwards, which
is reporting rather than consent.

`watchedTranscriptQuery` is now handed `freeTranscriptSources(...)` rather than the whole
ladder. "The background never spends" is a property of **what it can reach**, not a rule
anyone has to remember, in the same way the pipeline never creating a topic is a property
of the methods it holds.

Two consequences, both deliberate:

- **It needs no key.** Noticing the video and grabbing its captions costs nothing, so a
  browser that can reach YouTube does it unconditionally.
- **With only a metered rung it does not run at all.** That is a real change for today's
  key holders: browsing stops costing credits, and also stops pre-warming. They lose
  nothing they cannot get by pressing Create.

## What the app says about all this

Supadata stopped being required, so three surfaces had to stop implying it was.

`byoKeyNote.ts` was wrong twice — "both keys", and "never through our servers", the second
of which stays true only until the shared cache lands. The replacement says so, and the
file carries a note naming the clause that will need changing, so it is not discovered
wrong a second time.

`transcriptSourceNote.ts` holds what is missing in the words of the thing that is missing,
in one module, because the same three states are rendered by the dialog and by the empty
library and must not drift apart.

The Settings panel marks the Supadata key optional and reports which of three things is
true of it: not needed here, saved but not in use, or the only thing that could fetch a
transcript on this browser. The middle one matters most — it is the degrade-visibly rule
pointed the other way, telling someone what the app will actually do rather than leaving
them to infer it from a bill that never arrives.

## The web app has no free rung, and the trigger for giving it one is named

Everything above is the extension's. **The web app still has only the Supadata rung**, so
the copy tells a web user to install the extension and then cannot help them further. That
is the honest state rather than an oversight: a page on our origin cannot read YouTube,
and the rung that would fix it needs something that does not exist yet.

The design is the third rung of the ladder: the web app asks the user's **own installed
extension** to fetch for it, over `externally_connectable`. The extension already knows
how — `fetchYouTubeInWorker` and the whole InnerTube path are built and tested — so what
is missing is the conversation between the two, not the capability.

**It is deferred on a prerequisite, not on a doubt.** `externally_connectable.matches`
needs the extension's own id, and an unpacked development build gets a fresh one per
profile unless the manifest pins a `"key"`. There is no published listing yet, so there is
no stable id to list. Building it now would mean shipping against a development id and
swapping it later — and getting that wrong is a **silent total failure** that looks exactly
like "the user hasn't installed it".

So the trigger is named rather than left to memory: **the extension being published, and
having a Web Store id**. When that happens, this is the work:

- `externally_connectable.matches` in the manifest, with the web app's origin, and the
  prod id read from the environment rather than committed.
- A separate `chrome.runtime.onMessageExternal` listener — not a branch inside the
  existing one, because a web page and the extension's own documents are not equally
  trusted.
- The worker answering rather than rejecting, so "no extension" and "extension said no"
  stay distinguishable. Detection is the ping succeeding.
- **Only public video data crosses.** A transcript is a public artefact of a public video,
  identical for every user. No keys, no overviews, no library.
- The extension serving from its own transcript store first and writing back, so a web
  request warms it for both surfaces.
- One real-browser smoke test. A wrong `matches` pattern or an id mismatch cannot be
  caught by any fixture, and fails silently.

Worth settling before it is built: `externally_connectable.matches` may reject `localhost`,
which would mean a loopback alias (`lvh.me`) for local development. Unverified — there is
no existing usage in this repo to check against.

### Why this is not the bridge `v1-architecture-decisions.md` rejected

That document considered an `externally_connectable` bridge and turned it down, on the
grounds that it "makes the web app inert in any browser without the extension installed".
The next reader will find that line and think this contradicts it, so: it rejected the
bridge as **the mechanism for merging the two libraries**, where a missing extension
leaves the app with nothing to show. Here it is one rung of four. Remove it and the web
app still resolves through the shared cache, a Supadata key, or the service. Nothing goes
inert, and what is missing costs money rather than function.

## What is not built

- The shared-cache and service rungs.
- The web app's own free path, above.
