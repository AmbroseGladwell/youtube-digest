# Podcast screens

What a reader sees of a podcast episode. Trello OV-106's screens, from Claude Design's round of
13 Nov 2026 (`OV-106 1–6`, frames 106a–106x; its notes are in the design project's `DECISIONS.md`).
They ship as stacked PRs, like the rest of the card:

1. **An episode's overview reads and plays** (this doc, first). `PodcastSource` joins `Source`, and
   every place that shows an overview handles an episode: the reader, the library, the share page,
   its link preview, Markdown and MCP. The episode plays inside its note. Nothing makes one yet.
2. **Making one**: pasting a link, the steps while it's made, the failures, onboarding's entry, and
   `/privacy` and the terms.
3. **The panel beside a Spotify or Apple episode tab** (106k).

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

**For the next PR:** a Spotify share link carries `si=`, a token tied to the account that shared it,
and the share page shows the sharer's link. The link is kept without `si=` and the `utm_` parameters,
so a shared overview can't pass on who shared the episode with them. `/privacy` changes there too:
the link kept on the overview, the share page showing it, and the show's host receiving the reader's
request when the episode plays.

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

## Not in this PR

- **The shell's one bar naming what plays** (106q, 106q-2): "The overview" or "The episode", the
  paused overview held with Resume while the strip is in view, and the bar carrying the episode once
  the strip scrolls away. Here the two pause each other, but the bar still shows only the narration.
- **"Play the whole episode"** under a Listen to it anyway that says no (106s).
- **The show's art in the link preview's card** (106x): the card is drawn on our server, which would
  fetch the art, and that wants the same terms check as the rest of the card. The preview is
  typographic until then, as an article's is.
- **Samples of episodes on Start** say "Listen Less," as their verb. The design didn't draw one.
