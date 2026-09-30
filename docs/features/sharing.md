# Sharing an overview with a link

OV-30. A reader makes a link from an overview; anyone with it reads that overview in a
browser without an account; the reader turns the link off again. The designs are
`OV-30 Sharing.dc.html` (making and managing a link) and `OV-30 Shared Page.dc.html` (what
the recipient sees), both in the Claude Design project named in
`docs/features/overview-redesign.md`.

This document is the whole feature. **The API slice is built**: the table, the four routes,
the snapshot builder, the public page and its link preview. The reader's dialog, Settings ›
Shared links, and the read-only reader the page boots into are named in "Not built in this
slice" at the end.

## A copy, not a view

Sharing uploads a snapshot. Editing the overview afterwards changes nothing the recipient
sees until the reader chooses to replace it, and the dialog says so rather than letting the
link quietly change under them.

That has three consequences worth stating, because each of them is a thing the alternative
would have given for free:

- **It does not depend on sync.** A reader whose library never leaves their machine can
  still share, because the copy travels with the request rather than being read out of a
  record the server happens to hold.
- **The page is servable with one read.** No join, no permission check against a live
  record, and nothing to keep consistent between the two.
- **It can go stale.** So the reader is told when it has: see "Edited since sharing".

## What is in a shared copy, and what is not

| In | Out |
|---|---|
| The whole note: premise, core claim, verdict, key points, How to apply, What it sells, Watch it anyway?, chapters | The capture reason — the reader's own words about why they saved it |
| The video's title, channel, link, duration, publish date and thumbnail | Topics and tags — the reader's filing |
| The transcript | Read and favourite state, which was never on this record anyway (`docs/prototype/decisions.md`) |
| The narration: its key, voice, duration and line starts | The reader's name, anywhere on the page or in its head |
| | The verdict's "similar to" list |

**The transcript is in, which is a departure from the Trello card.** The card said the
transcript would never be shared; the design lists "Transcript and chapters" in the
dialog's own "Shared" column, and the shared page draws the Transcript tab with search
working. The design is the later decision and it wins. What is being shared is a video's
public captions, which `docs/features/shared-transcript-cache.md` already argues is not the
reader's to keep private.

**The verdict's `similarTo` is dropped** even though the rest of the verdict is shared. It
names the titles of the reader's *other* overviews, which the recipient has no business
reading, and its ids would be dead links from a page with no library behind it. The field
stays on the shape and is emptied, so the reader's own components render a shared copy
unchanged.

**The server builds the snapshot; the client never sends one.** `POST /api/shares` takes
the whole `Overview` and runs `shareSnapshot` over it server-side. A client cannot put a
private field into a share by constructing its own payload, because nothing it constructs
is stored. Two tests hold this: `shareSnapshot.test.ts` asserts no private field survives,
and `SharedNote.test.ts` fails the moment a field is added to `Overview` without a
deliberate decision about whether it is shared.

### Actions are shared, and so is the verdict

Both were open questions on the card. How to apply is written for the reader, not for the
recipient — but a shared overview with its conclusions removed is a summary of a video
rather than an overview of it, and the thing worth sending is the judgement. The design
settles it the same way.

## The link

A token of 96 random bits in the path, `/s/<token>`, base64url, sixteen characters. Long
enough that the only way to reach a copy is to be sent the link, short enough to read out.

It is stored as it is given, not hashed, unlike a session token. The dialog and Settings
both have to show the reader the link again, so the server has to be able to produce it. A
share link is a capability for content the reader chose to publish to anyone holding it,
which is a different thing from a credential.

**One live link per overview.** A partial unique index on `(account_id, overview_id) where
revoked_at is null` enforces it, and `on conflict … do update` is what makes sharing an
already-shared overview replace the copy behind the same link.

**Stopping does not delete the row, it marks it.** That is the whole reason `/s/<token>`
can answer "no longer shared" rather than a 404: a deleted row and a token nobody was ever
given are indistinguishable. A stopped link stays stopped forever, so **sharing again after
stopping makes a new link** — anyone still holding the old one keeps getting the honest
page. Sharing again while the link is live replaces the copy behind it and keeps both the
link and its original share date.

## Edited since sharing

The server stores a SHA-256 of the shared note beside the copy, and hands it back with
every share. The reader's client hashes what it would upload now and compares.
`shareContentHash` is one function in `packages/domain`, used by both sides, so the
comparison cannot drift.

**It covers the note alone.** A transcript filled in later, or narration rendered in a new
voice, is not an edit the reader made, and a notice that fired on those would teach them to
ignore it. The hash is taken over a key-sorted serialisation so that two objects with the
same content hash the same however they were built.

## The page

**Fastify writes the document; the app renders it.** This is a departure from the design
file, which describes the page as "rendered by the API". Rendering the reader's layout,
tabs, player and chapter list a second time in the API would be a second implementation of
the reader that drifts from the first. So the split is:

- The **API** owns the document: the `<title>`, `noindex`, the Open Graph tags, the status
  code, and the shared copy itself inlined as a JSON island.
- The **app** owns the page: it boots into a read-only reader from the copy already in the
  document, so there is one request and no flash of an empty reader.

A client-rendered route could not have given the first half at all — Messages, Slack and
WhatsApp read the HTML they are served and run no JavaScript.

### The head

`noindex, nofollow`, because a shared copy is for the people the reader sent it to.
`og:title` is the video's title. `og:description` is the read, listen and video lengths,
then the premise.

**No verdict in the preview**, which is the second departure from the Trello card. The card
expected the preview to carry it; the design's own head block does not, and it is right: a
blunt judgement of someone else's video is the reader's to deliver in their own message,
not something an unfurl says for them in a group chat. The verdict is on the page.

The premise goes into the description whole rather than cut at its first sentence. It is at
most 25 words, and a sentence splitter is a guess about someone else's prose.

`og:audio` is offered only when the copy has narration.

### 410, not 404

A stopped link is `410 Gone` with the page from design 30g, and carries nothing about what
was there — not the title, not the verdict, not in the body and not in the head. A token
that was never issued is `404` with a page saying the link goes nowhere. Two states, two
honest answers; telling them apart tells a prober nothing it could not learn from a 96-bit
guess.

Every response is `no-store`, so stopping a link is not undone by something's cache.

### The card image

`GET /s/<token>/card.png` draws the 1200×630 card from design 30i: the mark and wordmark,
the title in Gloock, the channel and lengths in Figtree, on the stone field.

- **Drawn per request, not stored.** It is a few hundred milliseconds, each service that
  unfurls a link asks once, and there is then nothing to invalidate when the copy behind
  the link is replaced or the link is stopped.
- **The fonts are bundled**, in `apps/api/assets/fonts`, and copied into the image. A
  preview crawler will not wait on Google Fonts, and the container has no fonts installed
  at all. Both faces are OFL; the licences sit beside them.
- **Text is measured by the renderer that draws it.** `measureText` renders a probe and
  reads its bounding box, so the width a line is wrapped to and the width it paints at
  cannot disagree. A second font library could, and a character-count estimate certainly
  would, on exactly the long titles that most need wrapping
  (`docs/prototype/constraints.md`, "Never let a model count, measure or time anything").
  A title runs to three lines and then ellipsises; a word too wide for a line of its own
  overhangs rather than being broken mid-word.

### The audio

`GET /s/<token>/audio.mp3` redirects to `/api/audio/<key>/file`, which is already public
and content-addressed, so a visitor hears the reader's own render without an account and
without a second store. `og:audio` wants one stable address per link, which is all this
adds.

## Counting

Views are counted on the page and nowhere else. A service unfurling a link fetches the
page, then the card, and sometimes the audio; the card and the audio read the row without
touching the counter, so that is one visit. A stopped link stops counting.

A count is all that is kept. No address, no user agent, no viewer identity, nothing that
would make the page a log of who read what.

Shares created and stopped are logged, as `shareCreated` and `shareRevoked`, with whether a
create replaced an existing copy and whether the copy carried a transcript or narration —
and nothing about the overview itself.

## Limits

| Limit | Counts | Per |
|---|---|---|
| `sharePageAddress` | 600 | hour, per address |
| live shares | 50 | account, at once |

The page limit is per address because the page has no session, the same reasoning as the
shared transcript cache. The live-share cap is what keeps this from becoming somewhere to
host a library; replacing the copy behind an existing link is always allowed, so an account
at its limit can still keep its shares current. Making a share is otherwise covered by the
ordinary per-account limit.

## Settled, and still open

**Any signed-in account, not Plus only.** The card asked. The design draws the dialog for
any signed-in account, and asks a signed-out reader to sign in. Sharing costs one row and
a page render; gating the one feature whose whole purpose is bringing new people in would
be the wrong thing to charge for.

**No expiry.** The card asked. Links are turned off deliberately, from the dialog or from
Settings, and never on a timer the reader did not set. An expiry date would have a place in
the dialog's status line and in the Shared links list if it is ever wanted.

## Not built in this slice

The reader's ⋯ menu item and its dialog, the phone share sheet, and Settings › Shared links
— all of `OV-30 Sharing.dc.html` above the API. The read-only reader the page boots into,
the "Watch Less, with The Overview" aside, and the "Save to my overviews" and "Make an
overview" paths through Create account — all of `OV-30 Shared Page.dc.html`. Until that
reader exists, a process serving the built web app hands the app a document it has no route
for; a process without one serves a plain readable document instead, which is what the
route tests assert against.

Design 30e labels the block holding the longer text "Premise" and a shorter closing line
"In one line", where the build's `overviewNoteLines` maps `inOneLine` to "Premise" and
`coreClaim` to "Core claim". That disagreement is the read-only reader's to settle, not
this slice's.
