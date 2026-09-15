# Architecture options — notes to explore later

Status: **resolved for v1.** This file is kept as the historical record of what was
considered — the six models below and the Ideas list are unchanged — but §11's open
decisions have since been made, and the Ideas list reconciled with them. See
`docs/architecture/v1-architecture-decisions.md` for the outcome and the reasoning behind it.
Written while studying `zarazhangrui/youtube-digest` as a reference implementation.

> Lives on the `taste` branch for now. Cherry-pick or merge to `main` when it
> graduates from notes to plan.

---

## 1. Context

From the README, the product is:

- Capture a video (today: phone share sheet), fetch transcript, generate a
  **structured judgment note** (not a summary): one-liner, core claim, key
  points, verdict (`NOVEL` / `SOLID BUT FAMILIAR` / `RECYCLED` / `THIN` /
  `DUBIOUS`), what's being sold, "try this" (7-day actions), "watch it anyway?".
- A library: search, filter by topic, **read**, or **listen** with
  sentence-by-sentence highlighting.
- Currently a one-person prototype. Captions-only, YouTube-first. Transcript
  retrieval is the fragile link; the pipeline must be resumable.

The **central product tension** (README): notes are personalised, so — unlike a
summarise-once-serve-many product — a shared per-video cache isn't possible
without dropping the thing that makes "try this" worth reading. Cost scales with
users × videos.

Two independent axes run through every option below:

- **Compute / money** — who pays for transcript + LLM + TTS calls, and do we run
  a server at all.
- **Storage / sync** — where notes and audio live, and how the extension and the
  web app see the same data.

---

## 2. Options at a glance

| | Model | Keys | Server we run | Multi-device | Verdict |
|---|---|---|---|---|---|
| **A** | Pure local, single device | User's, on-device | none | no | Simplest. Fine for a true single-machine tool. |
| **B** | Pure local, hosted shell | User's, on-device | static host only | no | Real URL, but still one browser + extension. Marginal gain over A. |
| **C** | Local + user's own cloud folder | User's, on-device | none | yes, via user's iCloud/Dropbox | "Own your data" purist option. Sync friction, Chromium-only. |
| **D** | **BYO keys + thin sync server** | User's, on-device | thin (store results + queue, no compute) | **yes** | **★ Favourite for v1.** Multi-device without taking on compute cost, billing, or abuse. |
| **E** | Local companion app | User's, on-device | none (companion runs on user's machine) | yes, if companion syncs | Only if the resumable queue must run with no browser open. Binary install. |
| **F** | Full managed backend | Ours | full (auth, generation, quota, billing) | native | The eventual destination once there's a paying audience. Not v1. |

All of A–E are **bring-your-own-key**: the user creates provider accounts
(transcript, LLM, TTS) and every generation call is paid by them, made directly
from a client that holds their keys. F is the only model where we hold keys and
carry compute cost.

Detail on **D** first (the favourite), then the rest, then the mechanics that A/B/C/E share.

---

## 3. Model D — BYO keys + a thin sync server ★ (favourite for v1)

The user still brings keys and still pays for **all** generation. We add a server
that stores only the *results*.

```
client → providers (user's keys) → client → our server → the user's other devices
```

Our server does: auth, a per-user digest store, audio object storage, and a
"pending capture" queue. It **never holds an API key and never calls a
provider**, so it has no compute cost and no key-abuse risk — a runaway client
only burns that user's own provider credits and storage quota.

### What it unlocks

- Real multi-device / "online app" feel — the actual goal.
- Our marginal cost per digest ≈ storage + egress, i.e. pennies, and predictable.
  A flat cheap subscription or a generous free tier both work; no metered-compute
  billing.
- Central cost tension stays neutralised — each user still pays their own way.
- **Phone capture becomes possible**: a PWA share target `POST`s a URL to the
  server's pending queue; next time a device *with keys* (the desktop extension)
  is open, it drains the queue, generates, and uploads. Server holds the queue,
  the keyed client is the worker.

### What it newly costs us (that pure-local didn't)

- **Accounts + cross-device auth** — the same auth work as the full managed
  backend.
- A server + DB + object storage that stays up: backups, migrations, on-call.
- **We now store user content indefinitely.** Retention policy, export,
  account-deletion cascade, data-processing disclosure. "Nothing touches our
  servers" is gone; the story becomes "you generate it, we keep it in sync."
- Sync logic: edit-conflict resolution, delete propagation, an offline queue that
  flushes on reconnect.

### Key question: do the API keys sync?

- **No — keys are per-device (recommended for v1).** Devices with keys can
  capture + generate; devices without are read/listen-only. Maps naturally to
  "generate on the laptop, listen on the phone." We never hold a third-party
  secret.
- Syncing keys through us means storing users' provider keys server-side —
  envelope-encrypted with a user-derived key at minimum. That turns a light
  service into a "we hold secrets" service. Avoid for v1.

### Audio: store it or not?

- Cheapest: don't store audio server-side. Regenerate on the consuming device if
  it has a TTS key; otherwise "listen" is keyed-devices-only.
- Fuller: store audio in object storage (~$0.015/GB/mo; 500 notes ≈ 750 MB) with
  a CDN in front. Still tiny per user. Needed for the podcast-RSS feature and for
  listen-only devices.

### Trust

The client computes the note and uploads it; the server can't verify it's a real
digest of that video. Fine for a personal library (you only pollute your own).
Revisit if notes ever become shareable.

### Why this is the v1 favourite

The extra work over pure-local is exactly auth + a thin CRUD/sync server — and
that is work the managed backend (F) needs anyway. Nothing is wasted. Going
managed later only *adds*: our provider keys, server-side generation, quota
metering, abuse control. The store/sync layer and the client↔server API built
here do not change.

### Rough server shape

- Auth: email magic-link or OAuth; short-lived access token + refresh; the
  extension stores the token in `chrome.storage.local` (`TRUSTED_CONTEXTS`).
- `GET/POST/DELETE /digests`, `GET/PUT /digests/:id`, `POST /digests/:id/notes`.
- `POST /captures` (queue a URL), `GET /captures?status=pending` (worker pulls).
- `PUT /audio/:noteId/:voice` (client uploads blob + timing marks), `GET` same.
- Object storage + CDN for audio; Postgres (or SQLite/Litestream at small scale)
  for everything else.
- Per-user storage quota (soft cap → prompt to upgrade or prune).

---

## 4. The other models

### Model A — Pure local, single device

BYO keys. The "web app" is shipped **inside the extension** as a full page
(`chrome-extension://<id>/app.html`), so it shares `chrome.storage` / IndexedDB
with the service worker natively — no bridge, no sync code. Side panel =
capture + quick glance; full page = read + listen.

- Wins: simplest by far; keys never leave the extension sandbox; fully offline.
- Costs: URL is `chrome-extension://…` (unshareable); one browser profile; no
  mobile; the only way in is "install the extension".

### Model B — Pure local, hosted shell

BYO keys. Web app served from a real URL; extension owns the data; web app talks
to it via `externally_connectable` (or a content-script relay on Firefox). See
§5.

- Wins: real URL, room for a landing page; the web app's data layer is forced to
  be an abstraction, so the later move to F swaps one adapter.
- Costs: Chrome/Edge for `externally_connectable`; the web app is inert without
  the extension in that same browser; still single-browser, no multi-device.
  Marginal benefit over A unless the hosted URL matters for onboarding.

### Model C — Local + user's own cloud folder

BYO keys. Extension and web app both open the same user-chosen folder via the
File System Access API (`showDirectoryPicker`). Notes as JSON files, audio as
mp3. The user drops the folder in iCloud Drive / Dropbox / Syncthing and gets
multi-device sync, backups, and grep-able data for free.

- Wins: multi-device with **no server we run**; strongest "own your data" story;
  natural export/import format.
- Costs: Chromium-only; permission prompt + re-grant friction; concurrent-write
  coordination if both surfaces write; it's a file tree, not a queryable store,
  so search/filter runs in memory on load; the phone still can't reach it except
  via a synced-folder inbox (§8).

### Model E — Local companion app

BYO keys. A Tauri/Electron menubar app owns a SQLite DB and serves
`http://localhost:PORT`; the extension and any browser tab talk to it.

- Wins: can run the resumable pipeline (queue, retries, scheduled channel
  polling) with **no browser tab open**; fast; offline; trivially shared between
  the extension and web app on that machine.
- Costs: the user downloads and runs a binary — not "add to Chrome"; we maintain
  a desktop app; it's essentially model F built on the user's machine.
- Only justified if headless/background processing is a hard v1 requirement.

### Model F — Full managed backend

We hold provider keys, generation runs server-side, we meter tokens + audio
minutes and bill for it. Requires accounts, a real backend, abuse control,
Stripe, and shifts YouTube-ToS exposure onto us. The destination once there's a
paying audience — explicitly **not** v1, but D is designed so the path to F
doesn't throw work away.

---

## 5. Extension ↔ web app: how they share data (mechanics for A/B/C/E)

**There is no storage both can just open.** Browser storage is partitioned by
origin. `chrome-extension://<id>`, `http://localhost:5173`, and
`https://app.example.com` are three different origins with completely separate
`localStorage`, `IndexedDB`, `chrome.storage`, and Cache Storage. You bridge
them: one side owns the data, the other asks for it.

| # | Mechanism | Used by | Cross-browser | Notes |
|---|---|---|---|---|
| 1 | Web app **is** an extension page | A | n/a | Same origin as the worker → shares storage natively, zero bridge code |
| 2 | `externally_connectable` — web app calls `chrome.runtime.sendMessage(EXT_ID, …)` | B, D-fallback | Chrome/Edge only | Extension is the data broker; clean request/response |
| 3 | Injected content-script relay — `window.postMessage` ↔ `chrome.runtime` | B on Firefox | yes | Same capability as #2 where `externally_connectable` is unavailable |
| 4 | Shared folder via File System Access API | C | Chromium only | `showDirectoryPicker` on the same dir from both surfaces |
| 5 | Local `http://localhost:PORT` server | E | yes | Companion app owns the store; everything is an HTTP client |

Under **model D** the web app talks to *our* server over HTTPS; the extension
does too. No extension↔web-app bridge is needed at all, except optionally #2 so
the web app can ask the extension to run a generation using the local keys.

---

## 6. Where each piece of data lives (BYO-key models)

| Data | Home | Why |
|---|---|---|
| API keys | `chrome.storage.local` **only**, `setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" })` | Keeps keys out of any content script; never uploaded, never in the web app's storage |
| Provider calls (transcript, LLM, TTS) | The **extension service worker** (the only context holding keys) | Web app asks it to run them (models A/B) or the server queue triggers it (model D) |
| Notes, transcripts, topic filing, verdicts | Extension IndexedDB (`unlimitedStorage`) locally; **our DB** in model D | Volume + querying; `chrome.storage.local` caps ~10 MB |
| Audio blobs + timing marks | IndexedDB / Cache Storage locally; object storage + CDN in model D | ~1–2 MB per 90s note; regenerate-on-demand + cache is acceptable |
| UI state (position, speed, filters) | Per-surface, not synced | Not worth the complexity |

---

## 7. The "listen" pipeline (all models)

- **Script step first.** Don't feed the structured note straight to TTS — reading
  "Key points: bullet, bullet" aloud is bad. An LLM step turns the note into a
  short spoken narration (~60–90s of connected prose), stored next to the note.
- **TTS call** made by the client holding the user's key.
- **Sentence-level highlight sync** needs timing data. ElevenLabs returns
  character timestamps; OpenAI `tts-1` does not; Google/Azure support SSML
  `<mark>`. **TTS provider choice is driven by this requirement.**
- **Cache** audio + timing JSON together, keyed by
  `(noteId, voice, ttsModel, scriptHash)`.
- **Player**: `<audio>` + Media Session API (lock-screen controls, background
  playback), speed control, a "play my unread" queue.
- **Private podcast RSS feed** (listen in a normal podcast app) needs the audio
  fetchable over HTTP → works in models B/C/D/E, **not** A
  (`chrome-extension://` URLs aren't fetchable by podcast clients).

---

## 8. Capture from the phone share sheet

The README's capture story is "save from the share sheet on your phone."

- **Models A/B/E**: nothing for a phone to send to. Capture is desktop-only
  (extension button / paste URL) until model D or F.
- **Model C**: an iOS Shortcut appends the URL to an inbox file in the synced
  folder; the laptop drains it on next open.
- **Model D**: a PWA share target `POST`s the URL to `/captures`; the keyed
  desktop client drains the queue and generates. This is the clean answer and a
  reason to favour D.
- **Model F**: native share target, server generates immediately.

---

## 9. What each model defers vs. requires

| | A / B (local) | C (folder sync) | D (sync server) ★ | F (managed) |
|---|---|---|---|---|
| Our server | none | none | thin, no compute | full |
| Accounts / auth | none | none | required | required |
| Billing | none | none | optional flat sub | required, metered |
| Abuse control | none | none | minimal (user burns own credits) | required |
| Multi-device | no | yes (user's cloud) | yes | native |
| Phone capture | desktop-only | synced-folder inbox | queue + desktop worker | native |
| We store user content | no | no | **yes** | yes |
| Privacy policy + store data-safety form | required | required | required + retention terms | required + retention terms |
| YouTube-ToS exposure | user's | user's | user's | ours |
| Compute cost tension | user's problem | user's problem | user's problem | **ours** (personalisation revives it) |

---

## 10. Migration path (keep it cheap)

Build the web app's data access as an interface now, regardless of model:

```
interface DigestStore  { list(); get(id); save(note); delete(id); search(q); }
interface AudioStore    { get(noteId, voice); put(noteId, voice, blob, marks); }
interface Settings      { getKeys(); setKeys(); getPrefs(); setPrefs(); }
```

- Model A: implementation talks to local IndexedDB.
- Model B/C/E: implementation talks to the extension bridge / folder / localhost.
- Model D: implementation talks to our sync API.
- Model F: same API as D, plus the server starts doing generation.
- The UI, the note format, and the player never change across any of these.

---

## 11. Open decisions

1. **Confirm v1 = model D.** Currently the favourite: multi-device, no compute
   cost, no wasted work toward F.
2. In model D, keys per-device (recommended) or synced? Per-device makes
   generation desktop-only and phone read/listen-only — acceptable?
3. Store audio server-side in v1, or regenerate on the consuming device?
4. Transcript source: a paid provider (Supadata-style) or our own
   innertube/`timedtext` extraction? BYO makes a paid provider the user's cost.
5. TTS provider — decided largely by whether sentence-sync highlighting is a v1
   requirement (it reads like it is → ElevenLabs or Azure/Google with marks).
6. Does the resumable queue need to run with no client open? If yes → model E or
   D-with-a-worker rather than D-with-the-desktop-as-worker.
7. Firefox / Safari in v1, or Chrome/Edge only?
8. Auth: magic-link vs OAuth provider(s).
9. Is verdict personalisation kept in a future managed tier (revives the cost
   tension), or does managed mode fall back to shared non-personalised notes?


## 12. Ideas

1. This should be a bring your own model app, we could provide calls to a couple different providers e.g. claude, chat gpt, deepseek and users can provide their api key and they can select their model to use to run the summarisation. This means we'd somehow have to get a list of models to select from for the provider they choose. Maybe they'd have to login through our app or something?
2. We store transcripts separately from user summaries. Transcripts should be stored as their own resource which we could use again if another user requests the same video, this way we can same calls to the service which grabs transcripts, we'll need to save the transcript with a date, youtube video id etc.
3. We should allow users to see the full transcript in the youtube digest UI as a separate tab or something.
4. We should provide an mcp connection so users can pull their youtube digests into their preferred chatbot easily to continue using them as a resource.
5. Paid youtube digest accounts can get, TTS, higher limit on youtube transcripts potentially, MCP connection, cloud storage so they can access across devices, and no adverts. Free accounts are local everything but we store the transcripts still on our server. So they still need to create an account.
6. Monetise free accounts by showing small adverts sections on the web app and chrome extension.
7. Price should be low e.g. £2.99 per month or something but we'll have to run numbers and would still be limits on numbers of digests etc.
8. Users should be able to create their own category folders and we put the summaries in the correct one or unknown, users can move them if they want.
9. Value proposition is to reduce the amount you watch but increase the amount you learn. Understand if a video is worth the watch, get key take aways, information validation, ways you can use the information and more.
10. Users mcp calls can access their summaries and the full transcripts only they have requested to ask further questions etc.
11. Users should be able to add a link to a video in the app itself and we kick off the digest job.
12. Other than running our digest summary we could allow users to tailor what they want from the digest, but this can't be a open text field, we should provide a couple of radio options users could select from to change what extra content is included, which we will have pre-built to extend the prompt. Some ideas could be 
13. We'd want to handle different video types e.g. for recipe videos you might want a ingrediants list and steps. For a process you might want step by step instructions. For political commentary you could have a subjectivity rating /bullshit indicator.
14. For the videos it suggests you to watch, we could recommend timestamps for the ranges that contain the specific parts that need watching to understand the ideas that can't effectively translate into text.
15. Need to come up with a new name because youtube digest has been taken.
16. I like the UI and UI organisation from this repo https://github.com/zarazhangrui/youtube-digest, in the chrome extension on the transcript page they allow the ability to follow playback which is cool, they also inject a digest button into the youtube page which we should do. Our chrome extension peice should also be opened to the right.
17. when the chrome extension is open it automatically grabs the transcript when a youtube video is opened, look at how the other digest does this.
