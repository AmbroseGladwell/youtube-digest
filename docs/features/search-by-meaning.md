# Search by meaning

OV-229. A reader, and an assistant over MCP, can find overviews by what they are about, not
only by the words they happen to use. Keyword search keeps working exactly as before and
always comes first.

Built in two slices on one card:

1. **The server** (this slice): embeddings stored beside each library, the worker that makes
   them, `search_overviews` and `get_overviews` matching by meaning, and
   `GET /api/search/meaning` for the app.
2. **The app's library search**, which calls that route and lists meaning matches under the
   reader's own word matches.

## Why it was needed

`searchLibrary.ts` requires every word of a query to appear, and the library's own search
matches the whole phrase. Topics are a handful of coarse buckets, and tags are the source's
own vocabulary. So a library could only be found by the words it used. An article on managed
decline in organisations and a podcast on why founders stay too long are the same idea and
share no word. An assistant over MCP reasons well over what it is handed, and it was handed
only what keyword search found.

## Why OpenAI

The owner asked for both options to be priced before choosing (9 Nov 2026). The spike took
111 of the owner's own overviews through The Overview connector (826 claims and key points)
and 29 searches written to describe one overview's idea without its words, such as
"impotence caused by adult content habits" for a note on erectile dysfunction and porn. Code
did all the scoring.

| | Right note ranked first | Right note in the top 5 | Time to embed one search |
|---|---|---|---|
| Keyword search today | — | 1 of 29 | — |
| OpenAI `text-embedding-3-large` | 29 | 29 | ~330 ms |
| **OpenAI `text-embedding-3-small`** | **28** | **29** | ~270 ms, the network round trip |
| `bge-small-en-v1.5`, run locally | 23 | 29 | 2–5 ms on a Mac CPU |
| `all-MiniLM-L6-v2`, run locally | 23 | 29 | ~2 ms |

`text-embedding-3-small` ranks almost as well as the large model at a sixth of the price, and
costs about $0.0000067 an overview and $0.0000002 a search (`cost-model.md`, "Search by
meaning"). Self-hosting would have avoided a privacy-page change, but needed a bigger API
machine and ranked worse, for a saving measured in fractions of a cent.

The searches were written by Claude, so they are one judgement of what "the right note" is.
That is why both the first-place count and the top-five count are reported.

**No similarity separates a right match from a wrong one cleanly**, for any model in the
spike. Ranking works; a threshold does not. So meaning matches are always "the closest few",
with a floor (`MEANING_FLOOR`, 0.3) that only drops what is plainly unrelated. A check against
the live API put a related pair at 0.65 and an unrelated one at 0.17.

## The unit is the claim

Each overview's core claim, each key point and a recipe's summary are embedded separately
(`claimsOf`). An overview-level vector is too coarse: a two-hour interview is about six
things. An overview's score for a search is its best-matching claim.

## Storage

`overview_embeddings` holds one row per overview: the rev it was embedded from, the model,
the tokens it cost, and its attempts. `claim_embeddings` holds the vectors, `vector(1536)`
through pgvector on Neon, with each claim's text hash and model. Both are keyed by account and
go with the account (`on delete cascade`).

- **Derived data, never synced.** Nothing here goes down the changes feed (`sync-metadata.md`).
  A device never sees a vector.
- **Keyed to the rev.** The overview record is replaced wholesale on regeneration
  (`CLAUDE.md`, the read and favourite lesson), so a search only uses an overview's vectors
  while their rev is the record's current rev. A regenerated overview is unmatched by meaning
  for the few seconds before it is re-embedded, and never matched on what it used to say.
- **Unchanged claims are reused.** A claim whose text hash is already stored is not paid for
  again, so filing an overview under a topic costs nothing.
- **Changing the model** means a background re-embed, since vectors from different models
  can't be compared. Every row names its model, and search only reads the current model's.

## The queue

`EmbeddingQueue` embeds whatever is pending, one overview at a time. **What is pending is
derived from the records**: a live overview with no embedding at its current rev. So there is
no job table to fall out of step, an overview written while the worker was down is found, and
the existing library is backfilled by the same path.

It is woken, never polled: `RecordsRepository` calls back once a write that changed an
overview commits, and the server kicks it once at start. A timer would keep Neon awake and
billing (`deploy.md`). A failure is retried after 1, 10 and 60 minutes, each a one-off timer,
and then left until the overview next changes. A record this server can't read is left the
same way. Embeddings of deleted overviews are dropped at the start of each run.

**Backfill**: the first start after this ships embeds every existing overview, newest stored
first. Until an overview is embedded, search finds it by word only.

## Word and meaning together

Keyword first, then meaning. The word matches come first in their usual order, so a phrase,
a name or a tag the reader remembers is never pushed down by something merely close in
meaning. Then come up to five overviews (`MEANING_RESULTS`) that no word matched, closest
first, each of which still has to pass every other filter. That is the simplest combination
that cannot surprise someone searching for a word they remember; a blended ranking was
considered and turned down for exactly that reason.

## The route

`GET /api/search/meaning?query=` (signed in, 1–200 characters) answers
`{ available: true, matches: [{ overviewId, similarity }] }`, closest first and above the
floor, or `{ available: false }` when no embedder is configured or it failed. The app runs its
own word match on the device and drops any meaning match it already shows. A query's vector is
cached in memory (500 most recent), since searches repeat.

**It never crosses accounts.** The comparison is filtered to the caller's account in SQL,
so each search scans only one reader's claims, at most a few thousand rows. That is also why
it scales without a vector index: more readers never makes one search bigger.

## Degrading visibly

With no OpenAI key configured, nothing is embedded and every search matches by word only. Over
MCP, when meaning can't be matched, the reply says "Matching by meaning is unavailable right
now, so these match by word only", so an assistant never takes a shorter list as complete.
The route answers `available: false` for the app to say the same.

## Logging

- `api.meaning.embedded`: the overview's id, how many claims, how many were new, how many were
  reused, the tokens and the model. This is where the real cost per overview is read from.
- `api.meaning.embedFailed`, `api.meaning.embedGaveUp`, `api.meaning.removed`,
  `api.meaning.workerStopped`.
- `api.meaning.searched`: where the search came from (`mcp` or `app`), how many matched by word
  (MCP), how many more only by meaning, and whether meaning was available. The meaning-only
  count is the number that says this card worked. **Never the query.**

## Privacy

Note text now goes to OpenAI for every reader with an account, whichever key wrote the
overview, and so does a search's text. The privacy policy's library, assistants, processors
and retention sections say so (`legal-pages.md`, revision log, 9 Nov 2026).

## Testing

The route and MCP tests run against PGlite with pgvector, using `makeConceptEmbedder`, a
stand-in that puts groups of words on the same axis, so two notes about one idea in different
words land close together. The tests cover:

- the vocabulary case;
- word matches before meaning matches;
- an empty library and a library of one;
- no crossing accounts;
- a regenerated overview never matched on its old claims;
- a deleted overview dropped;
- only changed claims re-embedded;
- a failed embedding retried;
- meaning unavailable.

Whether a real model tells apart two notes that share words but not ideas is a question of
model quality, answered by the spike, not by these tests.

## Not built

- The app's library search (slice two).
- A search-quality check that reruns the spike on demand. The scripts lived in the session's
  scratchpad and were not committed.
- Embedding the big picture once OV-225 lands; it carries an overview's scope and may be the
  best single field for this.
- Related overviews worked out ahead of time, with nobody searching: that is discovery, and it stays on OV-218.
