# Podcast screens

What a reader sees of a podcast episode. Trello OV-106's screens, from Claude Design's round of
13 Nov 2026 (`OV-106 1–6`, frames 106a–106x; its notes are in the design project's `DECISIONS.md`).
They ship as stacked PRs, like the rest of the card:

1. **An episode's overview reads and plays** (this doc, first). `PodcastSource` joins `Source`, and
   every place that shows an overview handles an episode: the reader, the library, the share page,
   its link preview, Markdown and MCP. The episode plays inside its note. Nothing makes one yet.
2. **Making one** (below): pasting a link, the steps while it's made, the failures, no transcript,
   and `/privacy`.
3. **Onboarding**: the trial reaching the podcast routes, and its entry in onboarding's table.
4. **The panel beside a Spotify or Apple episode tab** (106k, below).

**What is built, and where:**

| The decision | Where it lives |
|---|---|
| The link the reader shared | `PodcastSource.sharedFrom` in `packages/domain/src/Source.ts` |
| An episode's name, chip, length and way out | `sourceFacts.ts`: `sourceName`, `kindChip`, `sourceLength`, `sourceUrl`, `openPodcastLabel` |
| The head's art | `EpisodeArt` |
| The episode's player | `EpisodeEngine`, `useEpisodeEngine`, `EpisodePlayer` |
| Times that jump it | `LineRangeTag`'s `direct` chips; `PlaybackContext` |
| The note's times, transcript and chapters for an episode | `timedSource` |
| Square art in the library's 16:9 slot | `OverviewThumbnail` |

## The way out is where the reader came from

The episode's identity is the feed's (`podcast-links.md`), but a reader who pasted a Spotify link
goes back to Spotify (owner, 13 Nov 2026). The link they pasted is kept on their copy of the source,
`sharedFrom`, and everything that leaves the note goes there: ⋯ says "Open in Spotify", "Open in
Apple Podcasts" or "Open the show's page", the art opens the same place, and "Copy episode link"
copies it. `sourceUrl` gives it for every kind, so Markdown, MCP, the share page and recipes read one
helper rather than `source.url`. The share page uses the sharer's link (106w).

The platform is read from the link's own shape (`parsePodcastLink`), never stored separately, so it
can't disagree with the link.

The link is kept without Spotify's `si=`, a token tied to the account that shared it, or the `utm_`
parameters (`keptSharedLink`), since the share page shows the sharer's link and shouldn't pass on
who shared the episode with them. A `spotify:` address is kept as the web page it names.

## The head, the row and the chip

The head follows 147's lead layout with the show's square art where a video's thumbnail is: 112px on
the web, 88 on a phone and 72 in the panel (106l, 106m). Beside it the show, the Podcast chip
(`KindChip`, as on a library row) and the verdict. With no art, or art that fails, the show's name on
a stone tile. The meta line names the episode by its length, "1 hr 56 min episode", or "Episode" when
the feed gives none; a length is never guessed.

In the library the square art sits matted on the stone tint inside the 16:9 slot (106u), so rows stay
one height. The Source filter gains Podcasts, shown once the library holds one, as every kind is.

"Watch it anyway?" is "Listen to it anyway?" on an episode, and its answers say listening ("Worth
listening to one part"), on the page, aloud and in Markdown.

## One player, and every time jumps it

The design put the episode's own player in the note. A quiet strip under the head, "Episode audio":
back 15 seconds, Play, forward 30, the position and length, and a stone scrubber (106p). The position
is the audio element's own `currentTime`, never estimated (`constraints.md`), and the length is the
served file's once the element knows it, the feed's until then.

**The engine is a `PlaybackSource`.** The extension already moves a YouTube player beside the panel
through `PlaybackContext` (`following-playback.md`): a time in the note, the transcript and the
chapters seek it, and follow it as it plays. An episode's note provides its own `EpisodeEngine` there
instead, so all of that works on an episode unchanged: the transcript follows the episode, and every
time moves it. Its source key is the id the times are matched on, as its transcript is stored. An
episode's times are small play chips rather than the menu a video's open (`direct`), and Listen to it
anyway's range is "Play 1:43:10 – 1:51:20", which stops at the range's end.

**The audio element is made on first play,** so a note that is only read costs the show's host
nothing. Leaving the note stops the episode (owner, for now).

**One sound at a time.** Starting the episode pauses the narration where it was, and the narration
starting pauses the episode.

**A jump may land a little early.** Shows stitch ads into each listen, so the audio a reader hears
runs longer than the copy the transcript was timed against (`podcast-notes.md`, "Times and the
episode's audio"). After a time in the note moves the player, and only then, one line says so under
the strip for six seconds: "Shows add ads to each listen, so a jump may land a little early." Play,
the skips and the scrubber never show it. Screen readers hear it once per note.

**When the audio won't play,** the strip says so and offers the way out instead.

**Media from any host plays.** Checked on 13 Nov 2026: neither the web app nor the extension sets a
content security policy that limits media, so a feed's audio from any host plays in both. Chrome
upgrades an `http:` enclosure to `https:`; a host with no `https:` fails, and the strip says so.

## Making one

The second PR. A reader signed in to an account pastes an Apple Podcasts, Spotify or show-page link
into New overview, on the web's dialog, the home page's field or the panel and phone's sheet.

**What is built, and where:**

| The decision | Where it lives |
|---|---|
| Reading the link before Create | `usePodcastLink` |
| An episode or an article | `pastedLinkState`, `PastedLinkStatus` |
| The card, held and the failures | `PodcastLinkStatus`, `podcastLinkFailureCopy` |
| The run | `runPodcastOverviewGeneration`, `useRunPodcastGeneration`, `startPodcast` |
| The steps | `generationRunSteps` |
| No transcript | `RunErrorMessage`'s `PodcastNoTranscript` |
| Our key makes an episode | `OurKeyGenerationRequest`, `generateOverviewOf` |

**Read as soon as it settles,** as an article link is (`pasted-article-links.md`): what was found,
or why it can't be used, is known before Create, and reading costs nothing against the month.
A Spotify or Apple link is only ever an episode. Any other page may be a show's own episode page,
so it is read as an episode and as an article at once; it is an episode only once our server finds
one there, and a page that isn't one is left to the article. That second read is one more fetch of
the page on our server, inside the same per-address limit.

**The card** (106b) shows the art, "The Diary Of A CEO · Podcast · from Spotify", the title and
"1 hr 56 min · 10 Nov 2026", the date alone with no length. An episode already in the library
offers the way to it instead of Generate.

**Failures** (106d–106f) are our server's five reasons, each in the reader's terms and each ending
"No overview was used.": a whole show, not in the show's public feed (we never swap in a different
episode), most likely a Spotify exclusive, a feed we couldn't read, and no answer in time, which
alone offers Try again.

**The steps** (106g) are Finding the episode, done before Create with the length beside it, then
Looking for a transcript, a stage of its own because it is the one that fails for half of episodes,
then Writing the overview. They never say where the words came from. Recording the narration isn't
a step here, as it isn't for any kind: narration renders after.

**No transcript** (106h) is drawn as an everyday outcome: what happened, that it's common, that no
overview was used, "Transcribing is coming soon" where Transcribe it will go, and a pointer to paste
the episode's YouTube link instead. Nothing is left in the library (owner, 13 Nov 2026). Nothing is
reserved until the words are found, so nothing is used.

**The run** finds the words through `podcastTranscript` (the free routes: our cache and the feed's
transcript on our server, then the show's YouTube channel, searched in the reader's browser by the
extension and checked by our server, or searched by our server without one), keeps them on the
device under the episode's key for the Transcript tab, and writes the note with the episode as its
source. On our key the request carries the episode first, so it isn't read as the video it also
carries.

## Onboarding

The third PR. Both podcast routes take a signed-out trial token as `/articles/read` does: a read
spends one of the trial's reads (`reserveTrialRead`, now shared), and finding the words is allowed
while the token hasn't made its overview, with our server's YouTube fetching counted to the address
as a signed-out video's is. Onboarding's table claims Apple and Spotify links and makes the episode
from them (`onboarding.md`, "Any kind of link"). The card shows once the words are found, so an
episode with no transcript stops at the confirm step (106i) with "Transcribing is coming soon"
above the field for another link. Onboarding's bar says "Finding the episode" throughout rather than
the design's separate "Looking for a transcript" stage, since it has one fetching stage for every
kind.

## The panel beside an episode tab

The fourth PR, Trello OV-296 (106k, 106j). On an `open.spotify.com` or `podcasts.apple.com`
episode tab, the panel's home offers the episode as it offers an article (205a): text only, no
art from the tab.

| The decision | Where it lives |
|---|---|
| Which tab is an episode, a show's page, or neither | `useEpisodeTab` (`isPlatformPodcastLink`, `isPodcastShowLink`) |
| The card: finding, found, a show's page | `EpisodeOffer` |
| No transcript, in place of Create | `EpisodeNoTranscript` |
| The line on a note when the tab is another episode | `useOnThisTab`'s `episode` kind |

**Only the address is needed,** so Chrome is never asked for the site. Our server reads it through
`usePodcastLink`, as a pasted link is read, so the card says "Finding the episode…" for a moment and
then "{show} · Podcast · on Spotify", the title and "1 hr 56 min · 10 Nov 2026". Create waits for
the episode. One already in the library offers "Read overview" and "Already in your library". A
Spotify or Apple tab is never offered as an article, even where our server can't be reached.

**A show's page is known from its address** (`apple-show`, `spotify-show`) and isn't sent to our
server: "This is the show's page. Open one of its episodes, and you can make an overview of it
here." Its kicker is "Podcast · on Spotify", without the show's name, which only the tab's title
gives and in each app's own format. An episode our server answers "not an episode" for reads the
same.

**Our server's other reasons** use the pasted link's copy (`podcastLinkFailureCopy`) with "Use a
different link" dropped, since the tab is the link; "We didn't hear back in time" keeps Try again.

**No transcript** (106j) keeps the offer and puts 106h's words, shorter, where Create was, with
"Transcribing is coming soon". It stays until the tab moves on, which dismisses the run; nothing was
reserved or kept. Coming back offers Create again.

**The line on a note** (205e) says "Another episode on this tab" for another Spotify or Apple
episode, and none for a show's page or the note's own episode (its kept link matches). Making an
overview from it goes to home, where the episode is read and offered, rather than starting a run
straight away as an article does: an episode needs no grant asked inside the click.

**The address leaves the device sooner than an article's does.** An article is read only when
Create is pressed. Beside an episode, the tab's address goes to our server as soon as it is in front
of the panel, so the card can name it. That is the design's choice (106k), and `/privacy` says so
(OV-296 in `legal-pages.md`'s log).

## The terms review

The owner had the terms checked on 13 Nov 2026, before real readers, and the fixes are OV-297:
each reader's own transcript, Apple's call budget, no Apple page reads, "Listen on" links, the
YouTube position rewritten, and the privacy wording (`podcast-links.md`, "Terms";
`podcast-transcripts.md`, "Each reader's own copy"). The way out reads "Listen on Spotify" or
"Listen on Apple Podcasts" where this doc says "Open in".

## Not in these PRs

- **The shell's one bar naming what plays** (106q, 106q-2): "The overview" or "The episode", the
  paused overview held with Resume while the strip is in view, and the bar carrying the episode once
  the strip scrolls away. Here the two pause each other, but the bar still shows only the narration.
- **"Play the whole episode"** under a Listen to it anyway that says no (106s).
- **The show's art in the link preview's card** (106x): the card is drawn on our server, which would
  fetch the art, and that wants the same terms check as the rest of the card. The preview is
  typographic until then, as an article's is.
- **Samples of episodes on Start** say "Listen Less," as their verb. The design didn't draw one.
