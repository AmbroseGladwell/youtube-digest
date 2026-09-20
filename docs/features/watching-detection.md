# The video you're watching

The side panel sits next to a YouTube tab, and until now it asked you to paste the URL of
the video already on the screen beside it. This closes that gap: the panel knows which
video is in front of it, and the new-overview form opens with that link already in the
box.

## A capability the shell injects, not one app-core detects

`app-core` can't read `chrome.*`. It is mounted verbatim by both shells and has no way to
tell which one it is in — the same constraint that made `surface` a prop rather than a
runtime check (`src/app/SurfaceContext.ts`). So the browser-facing half is a small
interface the shell supplies:

```ts
interface ActiveVideoSource {
  subscribe: (onChange: () => void) => () => void;
  getVideoUrl: () => string | null;
}
```

The extension's side panel passes `chromeActiveVideoSource`; the web app and the
extension's own full-page document pass nothing. `useActiveVideoUrl()` falls back to a
source that never fires and always returns `null`, so a shell that can't see tabs needs no
flag and no branch — every affordance built on this is simply absent
(`CLAUDE.md`, "Degrade visibly"). The push-based shape is what lets the panel follow you
when you move to another video without polling for it.

The URL is reported, not the video: no metadata, no title, no transcript. The panel only
learns what it would have learned from a paste, which keeps the whole mechanism on the
near side of the transcript-fetch credit.

## Offered, not applied

Three states, and the distinction between the last two is the point:

| What the panel sees | What the form does |
|---|---|
| Nothing (web app, or no video in front of it) | Behaves exactly as it did before |
| A video, and the box already holds that link | Says where the link came from |
| A video, and the box holds something else | Offers the new one as a button |

A tab change never rewrites the box. Once the link in it is the one Generate would spend an
Anthropic call on, moving that link out from under you is a way to pay for the wrong video.
Opening the dialog is the one moment the box is filled from the watched video, because at
that moment there is nothing to overwrite.

## Where the line between automatic and asked-for sits

The reference extension this was modelled on (`docs/architecture/architecture-options.md`
Idea 17, `github.com/zarazhangrui/youtube-digest`) draws one line and states its reason in
`sidepanel.js`:

> `// DON'T run LLM analysis automatically - wait for user to click Overview tab`
> `// This saves tokens when user just wants to see the transcript`

We draw it in the same place:

| | Automatic |
|---|---|
| Noticing the video | yes |
| Fetching its captions | yes |
| Writing the overview | **no** |

Captions are fetched on sight because they are cheap, cacheable and reusable — a transcript
is keyed by video and already outlives the note taken from it
(`docs/features/transcript-storage.md`), so the same fetch serves a note generated now, a
note generated next month, and the reader's Transcript tab. The overview is not, because
it is the expensive call and the one that produces something only a person can ask for.

What makes that affordable there is a cache checked first, and the reference carries the
scar that proves it: its Digest button "used to force-clear the cache on every click, which
silently burned a transcript credit + analysis tokens per click". So the same order holds
here — `resolveVideo` asks the store before it asks the network, and it asks using the id
parsed straight out of the URL, so a video already held costs no call at all. That parsed
id is only ever used to ask a question: a parse that disagreed with Supadata's own id would
cost one metadata call and then resolve by the real id. It can never file captions under an
invented one.

## Both halves of the purchase are cached, in one record

Supadata sells two things per video — the metadata and the captions — and the panel would
otherwise buy the metadata twice: once to notice the video, once more when the note is
generated. So `StoredTranscript` carries the `VideoSource` the captions were fetched with,
in the same IndexedDB record, under the same `videoId` key.

One record rather than a second object store, because there is no case where you want one
half without the other: they are bought in the same breath from the same provider for the
same video, they go stale together, and deleting the transcript should not leave orphaned
metadata behind. A second store would add a consistency problem and buy nothing.

The field is **optional, not nullable**. Every other "added later" field in this project is
nullable because its records are always constructed fresh with an explicit `null`; this one
lives in records already written to a user's IndexedDB, which simply have no such key. A
missing block reads as a cache miss and costs one call to fill, so there is no migration
and no `DATABASE_VERSION` bump — and `resolveVideo` writes the metadata back onto the
record the next time it resolves that video, so old entries complete themselves.

One thing is deliberately not reused from the cache: `VideoSource.url`. Everything else
describes the video, but the url is what the reader's timestamp links point at, so a
resolution takes the url of the request being served rather than the one the first fetch
happened to use.

A background fetch that spends a credit silently would be the worst of both, so the form
says what happened — "Fetching its captions now" while it runs, and "Its captions are
already here, so generating won't buy them again" once they are in. That is the same
degrade-visibly rule pointed the other way: the panel reports the spend it made on your
behalf rather than leaving it to show up on a bill.

## What holds this up, and what doesn't

The `tabs` permission is what buys the active tab's URL, and on its own it is all this
feature needs: there is no content script, and nothing here reads the page.

Something else in the panel now does. Following playback reads the player's own
`currentTime`, which needs `scripting` and a host permission for `youtube.com` — see
`docs/features/following-playback.md` for what is injected and when. Noticing which video
you are on is still done entirely from the tab's URL, and would still work with those
permissions withheld.

`chrome.tabs.onUpdated` is listened to alongside `onActivated` because YouTube navigates
without a page load: a new video arrives as a URL change on a tab that was already open,
not as a fresh one. The reference handles both for the same reason, and its own comment
records that handling only `onUpdated` "is why the panel stayed visible when switching to
an already-loaded non-YouTube tab".

`pendingUrl` is read when `url` is empty because a tab can come to the front before its
navigation commits — a link opened from another app does exactly that — and the reference
falls back the same way.

The seam is also where the tests stop. `docs/conventions/frontend-testing-guide.md`
("This project's two-shell scope") puts the extension's `chrome.*` surface outside the IWFT
harness, and that harness still doesn't exist. So `chromeActiveVideoSource.ts` is kept
thin enough to read in one sitting and holds no judgement of its own — it reuses
`isYouTubeUrl` rather than deciding for itself what counts as a video. Everything that
does make a judgement lives in `app-core`, where `activeVideo.iwft.ts` drives it through a
simulated source: the prefill, the two silent cases, and the tab change that offers rather
than swaps.
