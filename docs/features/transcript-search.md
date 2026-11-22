# Searching what was said

OV-346. A name, a number or a phrase said in a video or an episode, but left out of its
overview, can be found: by an assistant over MCP, and (slice 2) from the library's search.
Search by meaning and the library's word search only ever looked at the overview
(`buildSearchHaystack`, `search-by-meaning.md`), so before this a word said only in the
transcript couldn't be found at all.

Built in two slices on one card:

1. **The server**: the search over the reader's transcripts, `GET /api/search/transcripts` for
   the app, a `search_transcripts` MCP tool, and `get_transcript` reading a long transcript in
   parts.
2. **The library**: a "Said in the transcripts" group between word matches and meaning matches,
   opening the transcript at the moment.

## Where it runs

**On the server**, over the full-text index chat already keeps (`transcript-storage.md`, "A
search index of the minutes (OV-352)"): one row per 60-second passage, per account, with a
`tsvector`. A device doesn't always hold every transcript (`transcript-storage.md` describes
one opening an overview whose words it hasn't fetched), so searching on the device would miss
some silently. MCP needs the server anyway, and one search serves both, so the matching rules
can't drift apart. The cost is that it needs a connection and an account. A library without an
account searches the overview only, as before.

Nothing new is stored: no second index, no copy of the words. A transcript kept before the
index existed is indexed on the account's next search (`backfill`), as chat already does, so
older overviews are searchable from the first search after this ships, without a migration.

**It never crosses accounts.** Every query is filtered to the caller's account in SQL, and a
hit only counts while a live overview of that account has that source.

## What matches

`transcriptQueryOf` splits what was typed:

- **A quoted run of words is a phrase**, matched in that order (`phraseto_tsquery`). Straight
  and curly quotes both work. A quoted single word, or an unclosed quote, is just words.
- **Every other word must be said within the same minute** (`plainto_tsquery`, all of them).
  A minute is the unit the index already has. "Anywhere in the transcript" would match almost
  every long source for two common words, and one minute is close enough to mean the words
  were said together. A phrase that straddles two minutes is missed; that is the price.
- **Words match by their stem**, through Postgres's English configuration: "running" finds
  "runs" and "run". Common words ("the", "and") are dropped, so a search of only those finds
  nothing rather than everything.
- **No fuzzy matching** for now. Machine-heard captions misspell names, and trigram matching
  (`pg_trgm`) would catch some of that, at the cost of a second index and noisier results.
  Left until a reader misses something because of it.

## Ordering

Sources that say it in the most minutes come first, then the best-ranked minute
(`ts_rank`), at most `TRANSCRIPT_RESULTS` (30). Each brings up to `MOMENTS_PER_SOURCE` (3)
moments, best first. In the library (slice 2) the group sits after the reader's own word
matches and before meaning matches, so today's results don't move.

## Snippets and moments

**Code cuts them, never a model.** For each matched minute, `transcriptSnippet` takes the
transcript's paragraphs (`transcriptBlocks`, the ones the transcript tab shows) that overlap
it, picks the one holding the most of the query's words, and:

- **the moment** is that paragraph's start, so opening it lands on a paragraph the reader can
  see in the transcript tab;
- **the snippet** is the paragraph itself when it is short (`SNIPPET_MAX_CHARS`, 180), or the
  sentences around the first match, grown sentence by sentence while they fit. A
  machine-heard paragraph with no sentence ends is cut at word edges, with an ellipsis on the
  cut side;
- **the marks** are where the query's words sit in the snippet (`marksIn`), by the same rough
  stemming, so the app can wrap them in `<mark>` and MCP in bold. A number never marks inside
  a longer one ("300" isn't marked in "3000").

Two minutes that pick the same paragraph give one moment.

## The route

`GET /api/search/transcripts?query=` (signed in, 1–200 characters,
`TRANSCRIPT_QUERY_MAX_LENGTH`) answers `{ matches: [{ overviewId, mentions, moments: [{ startMs,
text, marks: [{ start, end }] }] }] }`. `mentions` is how many minutes said it. The app drops
any overview it already shows as a word match.

## Over MCP

**A separate tool, `search_transcripts`**, rather than transcript matches inside
`search_overviews`. `search_overviews` stays a light listing to choose overviews from; a
transcript match is a different kind of answer (a moment and a sentence, not a note), and an
assistant asking "where did someone say X" wants exactly that. It takes `query` and an
optional overview `id` to search one transcript only. Each match gives the title, source,
how many minutes said it, the overview's id, and its moments: the time, linked to that
second of the video (`youtubeTimestampUrl`; a time alone for an episode, as `get_chat` does),
and the snippet with the words in bold. It ends by saying articles and recipes aren't
searched, since they keep no transcript.

**`get_transcript` reads in parts.** A transcript over about two hours passes 25,000 tokens,
where Claude Code refuses a tool result (`mcp-connector.md`, "The context budget"). It now
returns at most `TRANSCRIPT_PAGE_CHARS` (30,000 characters, about 7,500 tokens) of whole
paragraphs, and says where the part runs ("This part runs 0:00–34:10 of 2:09:58.") and the
cursor for the next. `from` starts at a time (`1:02:03`, `14:30` or seconds), at the
paragraph still being said then. A transcript that fits in one part reads exactly as before.
Its description and the server instructions say to find the moment with `search_transcripts`
first.

## In the library

Typing in the library's search still filters overviews by word on the device. Once typing
settles (`useSettledText`, as search by meaning does), the page asks `GET /api/search/transcripts`
once for that text (`useTranscriptMatchesQuery`), signed in only, since only a signed-in library's
transcripts are on our server.

`transcriptEntries` keeps the overviews no word in their overview already matched and that pass
every other filter, at most `TRANSCRIPT_ROWS` (10), and lists them under the word matches as
**Said in the transcripts**, with "Your words aren't in these overviews, but they were said."
Meaning matches come after and leave out anything already listed here, so a source said and
close in meaning shows once, as said.

**The row** is the ordinary library card with one more link under the title (no Design round;
owner, 22 Nov 2026). It reads **"Said in the video at 1:02:05"** ("episode" for a podcast) in
text, not only by colour, then the snippet with the words in `<mark>`. It borders on the left in
the brand tint and the marks use the transcript panel's match colour. Following it opens the
overview with the moment in history state (`TRANSCRIPT_MOMENT_STATE`): the reader opens the
Transcript tab there, as "Read in transcript" does, and clears the state so going back and
forward doesn't reopen it.

When the search fails the page says "Couldn't search what was said in your videos and episodes
just now." under the list, and lists word matches and meaning as before (degrade visibly).
When no overview's words match, "No overviews match these filters" gives way to the group.

**Analytics:** `library.search.transcriptMatched` counts, once per settled search, how many
overviews only a transcript matched and whether the search failed; `library.overviewCard.opened`
carries `from: "said"` for an open from the moment. Never the words.

## Logging

`api.transcripts.searched`: where the search came from (`app` or `mcp`) and how many
overviews matched. **Never the query.**

## Privacy

Nothing new is collected or sent anywhere: the search runs in our Postgres over the index
chat already keeps. The privacy page's transcripts section now says the library's search, with
an account, looks in the reader's copies, and an assistant can search them and read one in parts (`legal-pages.md`, revision log, 22 Nov 2026).

## Testing

- `transcriptQueryOf.test.ts`, `transcriptSnippet.test.ts`: phrase and word parsing, marks,
  sentence and word-edge cutting, the moment.
- `transcriptSearchRoutes.test.ts`: a word only the transcript holds, phrases, one-minute
  words, ordering, another account's transcript of the same video, a deleted overview,
  common words only, and the log line.
- `mcpTranscripts.test.ts`: the tool, one overview by id, an article's id, a transcript over
  two hours read in parts with no paragraph twice, and reading from a found moment.
- `transcriptEntries.test.ts`, `transcriptMomentFromLocation.test.ts`, `fetchTranscriptSearchApi.test.ts`.
- `librarySearchTranscripts.iwft.ts`: a word only the video said is listed as said, with its
  moment and marked word, and opens the Transcript tab there; a source already found by its own
  words, or said, isn't repeated (meaning included); a failed search says so.
