# Sharing an overview with a link

OV-30. A reader makes a link from an overview; anyone with it reads that overview in a
browser without an account; the reader turns the link off again. The designs are
`OV-30 Sharing.dc.html` (making and managing a link) and `OV-30 Shared Page.dc.html` (what
the recipient sees), both in the Claude Design project named in
`docs/features/overview-redesign.md`.

This document is the whole feature, and all of it is built: the table, the four routes, the
snapshot builder, the public document and its link preview; the ⋯ menu's Share…, its dialog
and phone sheet, and Settings › Shared links; and the page the recipient reads, with the
way in that it offers them.

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
| The whole note: premise, core claim, verdict, key points, How to apply, What it sells, Watch it anyway?, chapters, tags | The capture reason — the reader's own words about why they saved it |
| The video's title, channel, link, duration, publish date and thumbnail | Topics — the reader's filing |
| The transcript | Read and favourite state, which was never on this record anyway (`docs/prototype/decisions.md`) |
| The narration: its key, voice, duration and line starts | The reader's name, anywhere on the page or in its head |
| | The verdict's "similar to" list |

**The transcript is in, which is a departure from the Trello card.** The card said the
transcript would never be shared; the design lists "Transcript and chapters" in the
dialog's own "Shared" column, and the shared page draws the Transcript tab with search
working. The design is the later decision and it wins. What is being shared is a video's
public captions, which `docs/features/shared-transcript-cache.md` already argues is not the
reader's to keep private.

**The transcript that is shared is the one the reader can see.** The reader reads its own
store first and the account's copy on the server after, so a copy built from the local
store alone left the Transcript tab empty for every reader whose device had never fetched
it — which is any second device, and the web app whenever the overview was made in the
extension. The share goes through the reader's own query, so the two cannot disagree, and
the copy is usually already in hand.

It shipped that way because the IWFT backend simulator discarded the transcript a share
posted and rebuilt the copy from the overview alone. A test against it could not tell a
share that carried its transcript from one that did not. The simulator now keeps what was
posted, and `shares.snapshot(token)` is what a test asserts against.

**Tags are shared, and were briefly not.** The first cut of this treated them as filing and
left them out. They are not: the dialog's own "Kept private" list says reason, topics and
read state and does not mention them, the reader's own Overview tab prints them, and they
are written with the note rather than by the reader. A copy without them is not a whole
overview — at the time `Filing` required at least three, so such a copy could not even be
saved into a library, which is how the mistake was found. (Since OV-84 a stored note may hold
fewer, after the reader merges or deletes tags; `docs/features/tag-reuse.md`.)

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

Shares created and stopped are logged, as `share created` and `share revoked`, with whether a
create replaced an existing copy and whether the copy carried a transcript or narration —
and nothing about the overview itself. A page opened is `share viewed`, and a link that was
never made or has been stopped is `share page missing` with its `state`. No line carries the
token.

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

## Making and managing a link

**Share… sits in the ⋯ menu**, set apart from the editing items above it, and the menu's
existing Copy link becomes **Copy YouTube link** so the two links cannot be mistaken for
each other once a share exists (design 30a).

**The item is absent without an account**, rather than present and refusing. Everything
sharing offers reads `ShareApiContext`, which is null in a shell with no session, and hides
itself — the same rule as narration and sync. Signed out but able to sign in, the dialog
says why an account is needed and offers the way to one (30b·2).

**The dialog has one shape and five states** (30b, 30c, 30c·2, 30c·3, 30c·4). Before a link
exists it lists what is shared and what is kept private, so the reader reads that before
they decide rather than after. Once it exists it shows when it was shared, how many times
it has been opened, the link itself, and the two things they might now do.

**It is a bottom sheet on a phone** through the same CSS the delete dialog uses, and
**Share… hands the link to `navigator.share`** where that exists, with Copy link beside it;
where it does not, Copy link takes the primary slot and Share… is not drawn (30d).
Dismissing the system sheet is not a failure and is swallowed.

**Copied is the button's own label for two seconds**, and no toast: the reader is looking
at the button they pressed.

**The list is never served stale.** The view count and whether the copy is still current
are the two things the dialog is opened to find out, so the query's `staleTime` is zero and
opening the dialog asks again.

**Stopping asks first**, and stopping is optimistic — the reader has already decided, so
the row goes at once and comes back only if the server refuses.

## Settings › Shared links

Every live link in one list, with its title, when it was shared, how often it has been
opened, and a badge when the copy behind it is no longer the note this device holds
(30h). Stopping from here asks **inline, replacing the row**, the way revoking an
assistant's connection does, rather than raising a dialog over a list (30h·2). Nothing
shared says so plainly (30h·3), and on a phone each row becomes a card with its actions
under it at a full tap target (30h·4).

**The section is absent without an account**, and its row reads "3 shared" or "None". It
sits after Connections, where the design puts it.

## What can actually make a copy stale today

Nothing in the reader edits a field that is shared. The three things a reader can change
about an overview — the capture reason, its topics, and read state — are exactly the three
a shared copy leaves out, and an IWFT holds that line: editing the reason does **not** say
the link has gone stale.

So the notice is reached today only by a change arriving from somewhere else: a record
re-generated, or edited on another device and pulled down by sync. It is built now because
the comparison belongs with the rest of sharing, and because the day an overview becomes
editable it must already be right.

## The page the recipient reads

**It is the reader, in read-only.** The same tabs, the same note, the same transcript with
its search, the same chapters, the same player bar. None of it is a second implementation,
which is the whole reason the API writes only the document and the app renders the page.

What it drops is everything that belongs to an owner: the favourite, the ⋯ menu, Mark read,
the topic line and the capture reason. What it adds is the two things a visitor might want
— **Save to my overviews** and **Watch on YouTube** — and a head of its own, since there is
no library behind them to wear the app's chrome.

**The head is sticky and the tab strip rests against it**, as they do in the reader, and
both heights are measured rather than assumed — the read-along's scroll margin is built
from them. The strip takes this page's note column rather than centring itself on the
reading column, because here the note is one column of a grid rather than the whole page;
centred, it sat beside the text it belongs to.

**The stretch worth watching is a link here**, since nothing on this page can move a video.
That gap was the reader's too, and is fixed in the shared component
(`docs/features/following-playback.md`).

**The copy is read from the document, not fetched.** `readSharePayload` parses the JSON
island the API inlined. Anything it cannot read — no element, unreadable JSON, a shape a
newer server wrote — becomes "this link doesn't go anywhere" rather than a crash, because
the person holding the link can do nothing about either.

**Two reader components learned to be given a transcript.** `TranscriptPanel` and
`ChaptersPanel` each fetched their own from the reader's store; both now take an optional
`held` transcript, which is the copy that travelled with the share. Absent, they behave
exactly as before.

### Audio without an account

`sharedNarrationApi` presents the copy's own render *as* the narration API the player
already speaks: `peek` answers with it, nothing can be queued, and the file is the public,
content-addressed one every other player uses. The player engine is unchanged.

This is design 30f's deliberate departure from OV-40 1k, where a signed-out reader gets the
pacer: the audio belongs to the shared copy, so the visitor hears it. A copy shared without
narration gets no API at all, and falls back to the pacer exactly as a signed-out reader
does.

## The way in

The page is also how new people arrive, so both of its doors lead to Create account and
**both remember what they were doing**.

- **Save to my overviews** stores the copy itself.
- **The aside's paste-a-link** stores the link.

The intent lives in `localStorage`, validated on read, because the magic link opens a fresh
tab and a shape written by an older build must not break the account it is confirming. The
Create account page reads it and says what confirming will finish (design 30l's stone
note); `SignInPage` acts on it the moment the session exists, and **forgets it first**, so a
failure cannot leave one to fire again on the next sign-in.

A saved copy becomes the new reader's own overview with `captureReason: null` and no
topics: the sharer's reason and filing were never theirs to inherit.

## Not built

A manual check of how the link previews in Messages, Slack and WhatsApp, which wants a
deployed URL rather than a test.

Design 30e labels the block holding the longer text "Premise" and a shorter closing line
"In one line", where the build's `overviewNoteLines` maps `inOneLine` to "Premise" and
`coreClaim` to "Core claim". The shared page renders whatever the reader renders, so the two
still agree with each other; settling which is right is the note format's question, not
this feature's.
