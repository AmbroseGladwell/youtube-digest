# Following YouTube playlists

Design: "OV-27 1 Paste and Follow", "OV-27 3 Settings and Source" (27a–27h, 27p–27u);
"OV-95 1 Choosing a Pace", "OV-95 2 Pace in Settings" (95t–95z). Cards: OV-27, OV-95. The
queue the videos go into is `capture-queue.md`.

Most people already have a habit for "I want to get to this later": a YouTube playlist.
Following one turns that habit into overviews. A reader pastes a playlist link; the app
shows what is in it and what making it would cost, then follows it, with or without the
videos already there. Videos added to it later are queued each time the app opens.

It is for everyone, signed in or not, Free or Plus. Each followed playlist has a pace of
the reader's choosing, which caps how many of its videos are made in a day ("A pace for
each playlist", below). Beyond that it is limited by what limits any overview: the
reader's allowance, and behind it our server's daily safety cap on transcript fetches, at
which the queue waits visibly and carries on by itself (`capture-queue.md`, "Waiting at a
limit"). A 19-video playlist on a free account with no extension, followed as they come,
is made in full.

## A pace for each playlist

Decided 26 Oct 2026 (OV-95). A big backfill shouldn't spend a month's allowance, or a lot
of the reader's own key, in one go, or flood the library. So each followed playlist has a
pace (`PlaylistPace`):

| Pace | Made |
|---|---|
| *As they come* | everything, oldest first, until the month's allowance runs out |
| *Up to 5 a day* | the oldest five a day, the rest the next day, and so on |
| *Up to 1 a day* | one a day |
| *Only when I choose* | nothing by itself: videos queue and wait for the reader, using none of the allowance until chosen |

**The default is *Up to 5 a day*.** The reader sets their own default in Settings,
`Settings.defaultPlaylistPace`, which preselects the preview and only affects playlists
followed afterwards. A pace is never a required choice. There is no weekly or custom pace:
at 1 a day a 200-video backfill already takes about 7 months, and the preview says so.

**A day is the reader's day**, from local midnight. "Made today" counts the overviews from
that playlist saved since then, from the library, so every signed-in device counts the
same (`madeTodayByPlaylist`). A video made by hand has no playlist and never counts. A
video the reader chose to make now never counts either; which ones were chosen today is
this device's own (`CaptureQueuePreferences.chosenToday`), so a video chosen on another
device counts here until that device's day turns. The gap is accepted: the worst it does
is make one fewer that day.

The pace is on the synced `FollowedPlaylist` record (followed-playlist schema 2,
`CLIENT_VERSION` 8). Playlists followed before there were paces read as *As they come*,
which is what they were doing (`followedPlaylistMigrations.ts`).

How the queue waits on a pace, and how the reader makes waiting videos now, is
`capture-queue.md`, "Waiting on a pace".

## Public and unlisted only

Playlists are read with a YouTube Data API key our server holds, not with the reader's
Google account, so only a public or unlisted playlist can be followed. Private playlists
and Liked videos need the reader's own Google sign-in, which is OV-96. Watch Later and
watch history are not readable by any app at all, and have not been since 2016.

## Pasting a link

Every paste field checks the link before anything starts (`youTubeLink` in
`parseYouTubeUrl.ts`):

| The link | What happens |
|---|---|
| a video | as before |
| `playlist?list=…` | the playlist is looked up and previewed in place |
| `watch?v=…&list=…` | Generate is replaced by *Just this video* and *The whole playlist* (27a) |
| `list=WL`, `list=LL`, `list=LM` | refused: YouTube keeps them to itself (27g) |
| `list=RD…`, a Mix | refused, offering *Just this video* |
| a video watched from Watch Later | just the video: there is no playlist to offer |

In the New dialog a playlist link is taken on paste, or on Generate if it was typed, so a
half-typed `list=` is never looked up. The home page's field hands a playlist link to the
same dialog (`openWith` on the run controller). The link field stays disabled without an
API key, as it was: following needs no key, so Settings › YouTube playlists takes a
playlist link with or without one.

The side panel has no paste field. Its way in is Settings › YouTube playlists, where the
preview opens as a page of its own with Back (27f) rather than a dialog.

## Looking a playlist up

`GET /api/playlists/:id` reads the playlist whole: its title, owner, public or unlisted,
and every entry in the playlist's own order, 50 to a page, up to YouTube's own cap of
5,000 (`youTubeDataApiPlaylistReader`). Anyone may ask, signed in or not, 120 times an
hour per address (`playlistAddress`). Without `YOUTUBE_API_KEY` the route answers
`unavailable` and the flow says playlists can't be looked up here.

The Data API answers a private playlist and a missing one alike, with nothing. oEmbed
does not: it refuses a private playlist as unauthorised. So a playlist the API cannot see
is asked about once more there, and refused as `playlist_private` or
`playlist_not_found`. A private or deleted video stays in the playlist with its title
replaced; the reader marks it `private` or `deleted` from `status.privacyStatus`.

Each read is logged as `playlist read` with the quota units it spent (one for the
playlist, one per page) and how many entries it found. The default quota is 10,000 units
a day across every reader, which is a few thousand playlist checks; ask for more before
launch.

## The preview

Title, owner, public or unlisted, then the numbers as sentences, all counted from the
lookup in code (`playlistPreview`): how many videos, how many are already in the library
or already queued, how many are private or deleted, and how many will be made, oldest
first. The estimate is *About N tokens on your own API key* with its working beneath it,
`TOKENS_PER_OVERVIEW` (30,000) times the count, rounded to millions past a million and
always labelled as an estimate (`docs/prototype/constraints.md`).

Under the estimate, one line holds the pace (95t): *Pace: Up to 5 a day · your default*,
what it means for this playlist (*21 videos at 5 a day: about 5 days*, rounded up and read
in months past 60 days, `paceConsequence`), and *Change*. Change opens the paces in place
as a radio group, *Pace for Psychology*, each with its result written out; choosing is
immediate and there is no Done (95u). With nothing to backfill, the sentence speaks only of
new videos. A one-video playlist hides the pace, and so does a playlist already followed,
whose pace is changed in Settings. The New dialog scrolls when the open choice makes it
taller than the window.

*Make overviews for all N* (*Make its overview* for one) follows the playlist and queues
what is there. *Only new ones from now on* follows it and queues nothing. Cancel follows
nothing. When there is nothing left to make, only *Only new ones* is offered. An empty
playlist is refused with *Follow it anyway*. Focus moves to the first action when the
preview opens.

A playlist already followed previews the same way and says so; its backfill is still
offered, and nothing is followed twice.

The one-off grab (take these videos, don't follow) was left out on the design's advice:
*Only new ones* and Unfollow already cover it. There is room for a quiet link under the
actions if readers ask for it.

**The month's allowance** (95s, and 95v with a pace; OV-131): when what's left this month
on every key the next overviews could use is less than the backfill, a stone-tint line in
the facts card says what that means before anything runs (`allowanceLine`). At a pace: *Your
allowance covers 10 more this month. At 5 a day that’s the next 2 days; the other 11 wait
for 1 November, then carry on at 5 a day.* As they come: *10 of these 19 can be made now:
you have 10 left this month. The other 9 wait in the queue and carry on by themselves on 1
November.* *Only when I choose* spends none of it, so says nothing. The actions don't change.

## Following

A followed playlist is a synced record of its own kind, `followedPlaylist`, so every
signed-in device follows the same playlists (`FollowedPlaylist`, `sync-api.md`). It holds
the title, owner and privacy as last read, when it was followed, its pace, and
`unavailable` (`private` or `gone`) once a check finds it can no longer be read.

Following marks every entry in the playlist as seen on this device, and the backfill, when
asked for, queues what is there (`useFollowPlaylistMutation`). It refreshes the followed
playlists before the queue, so the queue knows the new playlist's pace before it sees its
videos; until the followed playlists have loaded at all, the queue makes nothing.

## New entries

What a device has already seen of a playlist is that device's own, never synced
(`PlaylistCheck`). New entries are what this device has not seen, not what was added
after a date, because a playlist can be reordered by hand and YouTube's "added" date is
not reliable enough on its own (`newPlaylistEntries`). Anything already made or already
queued is skipped.

A device checking a playlist it has never checked, one followed on another device, has
nothing to compare against. It queues what was added after the playlist was followed and
marks everything as seen. Each device queues and makes on its own, so two devices open
at once could make the same new video; each checks the library just before making a
video, so the second one skips it once the first one's overview has synced
(`capture-queue.md`).

## Checking on opening

Each time the app opens, every followed playlist is looked up once, including one that
arrives with a pull after opening (`useCaptureQueue`). What is new is queued, the check is
saved, and a playlist whose title, owner or privacy changed, or that is readable again,
is rewritten for every device. A playlist refused as private or gone is marked
`unavailable`, and its row and its overviews say so. A check that fails is reported as the
`playlistCheckFailed` client warning, and the rest carry on.

## Settings

Settings › YouTube playlists sits after Connections at `/settings/playlists`, shown
wherever there is a server to read playlists through. Its row reads *Following N* or
*None* (`settings.md`).

Each followed playlist shows its title, linked to it on YouTube; its owner, privacy, the
number of videos this device last saw in it, and how many overviews it has given; then,
in ink, its pace and what waits on it (*Up to 5 a day · 7 waiting*) with when this device
last checked it. One that went private or was deleted says so in warning ink and words,
has no pace to set, and can still be unfollowed. *Unfollow* asks once, inline, with the
numbers.

The pace pill beside Unfollow (95x–95y), labelled *Pace for Psychology: Up to 5 a day*,
opens the paces, each saying what it would do to what waits (*7 waiting at 1 a day: about
7 days*, `paceWaitEffect`). A change saves straight away and the row says once, politely,
what it did: *Now up to 1 a day. 6 of the 7 wait for tomorrow.* (`paceChangedLine`). On a
phone the pill opens a sheet of radios instead (95z). Above the list, *Pace for new
playlists* is the reader's default, with the same pill.

Empty, the section teaches the habit the feature is built around: an unlisted playlist
called "Overview", saved to instead of Watch Later.

## Unfollowing

Unfollowing deletes the synced record, takes the playlist's waiting videos out of this
device's queue, and leaves what needs attention until it is dismissed. Another device
unfollowing does the same here when the tombstone is pulled
(`IndexedDbSyncStorage.applyChanges`). The overviews already made keep their From line.

## Signing in

The move on sign-in (`account-libraries.md`) takes followed playlists, their checks and
the queue into the account's library too (`moveFollowingInto`). Where the account already
follows a playlist, its own record is kept.

## The From line

An overview made from a playlist stores where it came from, `Overview.fromPlaylist`, the
playlist's id and title (overview schema 7). It is on the overview rather than looked up,
so it survives unfollowing and syncs with the note. It is private: a shared copy never
carries it (`SharedNote.ts`).

Under the byline, on its scale (27t): *From **Psychology** playlist · Manage*. The name
opens the playlist on YouTube; *Manage* opens Settings while the playlist is followed.
Unfollowed, *Manage* goes. Followed and gone from YouTube, the name is plain text with
*no longer on YouTube*. Library rows carry no mark for now.

## Analytics

`playlists.link.choiceMade`, `playlists.preview.followed` (with the backfill, the counts,
the pace and whether it was the reader's default), `.cancelled` and `.refused` (with why),
`playlists.settings.*` (including `paceChanged`, with how many waited, and
`defaultPaceChanged`) and `playlists.fromLine.*`. The check on opening is the app acting, not the reader, so it is
a log line and a client warning rather than an event (`docs/architecture/analytics.md`).

## Not built

- Following with the reader's Google account, for private playlists and Liked videos (OV-96).
- Filing a playlist's overviews under a matching topic, and a library filter by playlist.
- Dropping a queued video that has left its playlist: it stays queued, on the design's
  advice that the reader may have tidied the playlist after saving.
