# In-app chat: what a message costs, and whether to build it

OV-267, an investigation, 15 November 2026. It asks whether a reader should be able to ask
questions about an overview inside the app, and answers with measured cost and quality rather than
impressions of YouLearn and Recall. Nothing here is built. `product-direction.md` ("Decisions in
flight", section 1) says OV-235 owns the position this reopens, so the recommendation below is
written as a change to OV-235's exception test.

## The answer

**Build it, small: chat about one overview, on GPT-6 Luna, with the whole transcript in the
prompt and no retrieval.** On this set a message costs about **$0.0003**, and a heavy month (300
messages) about **$0.10**, which is about three Sol overviews. Luna answered as well as Sol, and
both declined every question the video doesn't answer. The cost objection to chat is gone, and
what remains is whether readers want it, which only testers can show.

Why competitors can sell "unlimited" chat comes down to two things on this evidence: **prompt
caching and a small model**. Retrieval made no difference to cost once caching was on, and it
was slightly worse at questions that need two moments.

## How it was measured

`packages/model-comparison/src/chat/` and four commands (`chat-prepare`, `chat-retrieval`,
`chat`, `chat-report`). The outputs are in `.local/chat/` (never committed), as OV-92's runs are.

**The sources.** Six overviews from the owner's library, read through The Overview connector, with
their transcripts fetched by the production InnerTube client (`CHAT_SOURCES`):

| Source                                      | Length  | Kind                                   |
| ------------------------------------------- | ------- | -------------------------------------- |
| Creatine, debunked (Vox)                    | 9:35    | narrated explainer with studies        |
| Build What They Can't (Kent C. Dodds)       | 15:57   | conference talk with case studies      |
| Don't Give AI Your Data (Thu Vu)            | 17:13   | screen-recorded tutorial               |
| Netflix's Elizabeth Stone (Lenny's Podcast) | 1:12:07 | long podcast interview                 |
| Erica Komisar (Mind Pump)                   | 1:20:27 | long podcast interview, judged dubious |
| Robert Pape (The Diary of a CEO)            | 1:29:21 | long interview, judged dubious         |

The card asked for a two-hour source. The library's longest was 89 minutes, and the owner chose
not to add OV-87's 2h22 hearing, because its overview would have been the harness's rather
than a library note. The largest prompt in the run was 17,385 tokens. A two-hour transcript would
be roughly double that, which is still small for both models.

**The questions.** Six per source, 36 in all, in the same order everywhere: one the overview
already answers, two only the transcript answers, one that needs two moments at least a quarter
of the video apart, and two close to the subject that the video never answers. Each answerable
question carries a verbatim quote from the transcript, which code locates, so the expected moment
comes from code, never from a model (`locateQuote`, `docs/prototype/constraints.md`). Claude wrote
the questions, the same caveat `search-by-meaning.md` records for its searches. The chat
models are OpenAI's, so no model judged its own work.

**The shapes.** Transcripts are cut into 60-second passages, each with an id and its start time
(`transcriptPassages`). In every shape the model answers in JSON: the answer, whether the source
covers it, and the ids of the passages it rests on. **Code turns those ids into times**, so a
citation's timestamp is never a model's number.

- **Full transcript:** every passage in the system prompt; the question alone in each message.
- **Passages:** each question with the 8 passages closest to it by `text-embedding-3-small`.
- **Overview and passages:** the overview (as `get_overview` serves it) in the system prompt,
  and the 8 closest passages with each question.

Each source's six questions are one conversation, history kept, so the follow-ups show what
caching does. Each shape ran on GPT-6 Luna and on GPT-6.1 Sol, the current overview model, twice.
That makes 72 conversations and 432 messages, for **$1.38** on the evals key. Prices are
`modelPrices.ts` as checked on 9 November 2026: Luna $0.10 in, $0.01 cached, $0.50 out per
million; Sol $2, $0.10 and $10. "No caching" re-prices the same measured tokens with every prompt
token at the full input rate.

**What code scores:**

- **Answered or declined rightly:** the source-covers-it flag matches the kind of question.
- **Cited the right moment:** every expected moment falls inside a cited passage, within 10
  seconds of its edges.
- **Named the expected detail:** the answer contains one of the question's expected terms (a
  number or a name).
- **Cited a passage it wasn't given:** an id that isn't in the material.

## Retrieval, measured first

For each passage size, how often the closest passages included every expected moment of the
24 answerable questions. Only embeddings were spent:

| Passages            | Every moment retrieved | inOverview | transcriptOnly | twoMoments |
| ------------------- | ---------------------- | ---------- | -------------- | ---------- |
| 30 s, closest 3     | 17/24                  | 4/6        | 12/12          | 1/6        |
| 30 s, closest 5     | 20/24                  | 6/6        | 12/12          | 2/6        |
| 30 s, closest 8     | 22/24                  | 6/6        | 12/12          | 4/6        |
| 60 s, closest 3     | 19/24                  | 5/6        | 12/12          | 2/6        |
| 60 s, closest 5     | 22/24                  | 6/6        | 12/12          | 4/6        |
| **60 s, closest 8** | **23/24**              | 6/6        | 12/12          | 5/6        |
| 120 s, closest 3    | 19/24                  | 6/6        | 11/12          | 2/6        |
| 120 s, closest 5    | 23/24                  | 6/6        | 11/12          | 6/6        |
| 120 s, closest 8    | 23/24                  | 6/6        | 11/12          | 6/6        |

60 seconds and the closest 8 went into the chat run: they found as much as 120-second passages
for less text, and a citation lands within a minute. **Embedding costs about 12,000 tokens per
hour of video, $0.00024 an hour**, whatever the passage size, so embedding a whole library costs
cents. A question costs about $0.0000002 to embed, the figure search already has.

## Cost per message

| Model · shape                | Prompt tokens (median) | Cached | Output tokens (median) | Per message, cached | Per message, no caching | Under an hour | Over an hour | Latency (median) |
| ---------------------------- | ---------------------- | ------ | ---------------------- | ------------------- | ----------------------- | ------------- | ------------ | ---------------- |
| Luna · full transcript       | 10,087                 | 83%    | 84                     | $0.00034            | $0.00104                | $0.00015      | $0.00053     | 1.6 s            |
| Luna · overview and passages | 8,190                  | 74%    | 80                     | $0.00038            | $0.00089                | $0.00038      | $0.00037     | 1.7 s            |
| Luna · passages              | 6,242                  | 72%    | 87                     | $0.00032            | $0.00069                | $0.00033      | $0.00031     | 1.6 s            |
| Sol · full transcript        | 10,106                 | 83%    | 58                     | $0.00575            | $0.021                  | $0.00247      | $0.00902     | 2.3 s            |
| Sol · overview and passages  | 8,223                  | 74%    | 60                     | $0.00668            | $0.018                  | $0.00686      | $0.00650     | 2.5 s            |
| Sol · passages               | 6,265                  | 72%    | 58                     | $0.00564            | $0.013                  | $0.00583      | $0.00545     | 2.3 s            |

The retrieval shapes include each question's embedding. Re-ranking was not tried: retrieval
already found 23 of 24 moments, and the shape it would improve isn't the one recommended.

**Caching does most of the work.** The full transcript costs three times as much per message
without caching, and about the same as retrieval with it. OpenAI caches a repeated prefix of a
prompt by itself (`prompt_cache_key` keeps a conversation together), and the spike's reports show
the writes and reads. A first message pays to write the cache, and later ones read it at a tenth
of the price.

**Retrieval saves money only on long videos**, and not much: over an hour, Luna's full transcript
costs $0.00053 a message against $0.00031 for passages. Under an hour the full transcript is
cheaper, because the passages repeat in the history while the transcript is cached once.

**Per reader-month,** at this set's mix of lengths. Light is 15 messages, typical 60 and heavy
300; these are assumptions, since there are no readers yet:

| Model · shape                | Light (15) | Typical (60) | Heavy (300) | Heavy, all over an hour |
| ---------------------------- | ---------- | ------------ | ----------- | ----------------------- |
| Luna · full transcript       | $0.005     | $0.020       | $0.10       | $0.16                   |
| Luna · overview and passages | $0.006     | $0.023       | $0.11       | $0.11                   |
| Luna · passages              | $0.005     | $0.019       | $0.10       | $0.09                   |
| Sol · full transcript        | $0.09      | $0.35        | $1.72       | $2.71                   |
| Sol · overview and passages  | $0.10      | $0.40        | $2.01       | $1.95                   |
| Sol · passages               | $0.09      | $0.34        | $1.69       | $1.64                   |

For scale, an overview on Sol costs about $0.033 (`tiers.md`). A heavy Luna month is about three
overviews. A heavy Sol month is about fifty, which is why Sol is wrong for chat.

**Conversations here were six messages long.** A longer one carries more history. Its cost per
message grows, slowly, because history is cached too. A limit on messages per conversation
(below) bounds it.

## Quality per shape

| Model · shape                | Answered or declined rightly | Declined what it doesn't say | Cited the right moment | inOverview | transcriptOnly | twoMoments | Named the detail | Cited a passage it wasn't given |
| ---------------------------- | ---------------------------- | ---------------------------- | ---------------------- | ---------- | -------------- | ---------- | ---------------- | ------------------------------- |
| Luna · full transcript       | 72/72                        | 24/24                        | 46/48                  | 12/12      | 24/24          | 10/12      | 48/48            | 0                               |
| Luna · overview and passages | 72/72                        | 24/24                        | 44/48                  | 12/12      | 24/24          | 8/12       | 48/48            | 0                               |
| Luna · passages              | 72/72                        | 24/24                        | 45/48                  | 12/12      | 24/24          | 9/12       | 48/48            | 0                               |
| Sol · full transcript        | 72/72                        | 24/24                        | 47/48                  | 12/12      | 24/24          | 11/12      | 47/48            | 0                               |
| Sol · overview and passages  | 72/72                        | 24/24                        | 45/48                  | 12/12      | 24/24          | 9/12       | 48/48            | 0                               |
| Sol · passages               | 72/72                        | 24/24                        | 44/48                  | 12/12      | 24/24          | 8/12       | 48/48            | 0                               |

No call failed in any shape.

- **Every miss is a two-moment question on a long video.** On the Netflix interview, every
  retrieval run missed the late moment, because retrieval never brought it back, and both models
  got it from the full transcript every time. The Pape question is hard everywhere: 9 of its 12
  runs missed one moment.
- **Luna is as good as Sol here.** One citation apart over 72 messages.
- **The overview added nothing measurable** to the passages, and cost more.
- **Both declined all 24 unanswerable questions in every shape**, even where the answer is common
  knowledge (creatine and kidneys, Waze's founders). The prompt's rule, "never answer from general
  knowledge, even when you know the answer", held.

**What this can't show.** The set is small and mostly easy, so most columns are at their ceiling.
Only two-moment questions separate the shapes, and only a little. Citing the right moment and
naming the detail don't prove an answer is right in every word, and nobody read all 432 answers.
The answers were checked by hand against the expected ones for 32 of Luna's answerable
questions (four sources, full transcript and passages), and none was wrong. That is a
judgement, not a score. What the set does show
is the floor: a small model with the whole transcript is grounded, cites properly and declines
honestly, on real library sources up to 89 minutes.

## Recommendations

### Scope: one overview, then nothing wider in the app

- **One overview per conversation.** It is the bounded case: the material is one source the reader
  saved, and the measurements are for it.
- **Not across the library or a project, at first.** That was the call on 15 Nov, leaving
  open-ended synthesis to the connector. The owner reopened it on 19 Nov. OV-307 measured chat
  across sources, the whole library and projects, and it replaces this bullet: see
  "Chat across sources" below.
- **No web search.** It costs per call, it breaks "answer only from what you saved", and it is
  what the reader's own assistant is better at.

### Retrieval: none for now

- **Send the whole transcript.** At these lengths it costs the same as retrieval once cached,
  it's slightly better on questions that need two moments, and it needs no embeddings, no vector
  storage and no backfill. The model's context is not the limit: a two-hour transcript is about
  35,000 tokens.
- **Transcript chunk vectors are not built.** This answers `product-direction.md` section 2's open
  question. The card's idea of making them once per video and sharing them across readers ran into
  OV-295 the day before this report: the terms review retired the shared transcript cache, because
  keeping and serving a source's words to every reader has no UK exception to stand on
  (`shared-transcript-cache.md`). Per-account chunk vectors would be lawful and cost almost nothing
  to make ($0.00024 an hour of video). Stored, though, they take about 60 rows of 1,536 numbers per
  hour of video per account, which is real Neon storage for no measured gain.
- **Reopen this** if sources much longer than three hours become common. The code is in the
  spike. Chat beyond one source was reopened, and "Chat across sources" below answers it.
- **If chat goes beyond one source, start from search by meaning, not transcript vectors.**
  OV-229 already embeds each overview's big picture, core claim, key points and recipe summary,
  one vector per claim (`claimsOf`, `search-by-meaning.md`). That is enough to pick which sources
  a question is about. The closest few overviews by claim then go in with their whole
  transcripts. At about 12,000 tokens an hour of video, three or four hour-long sources fit, and
  caching keeps follow-ups cheap. That needs no new embeddings, and within each source it is the
  shape that won here.
  - **The gap is a detail the overview left out.** A `transcriptOnly` question, such as an exact
    dose said in the video but not in the note, may match no claim, so the right source is never
    picked. One source hid this, because the whole transcript was always there.
  - **Search has no clean cutoff.** OV-229 found no similarity that separates right matches from
    wrong ones, so "the closest few" always returns something. Declining when the library has no
    answer then rests on the model, which declined 24 of 24 here.
  - **So measure before adding passage vectors.** Using this harness, ask the same questions against a
    whole library and count, in code, how often claim search puts the right source in the closest
    few, by question kind. Add per-passage vectors only if `transcriptOnly` questions miss often.
    That is OV-307 (https://trello.com/c/7zrzBysy).
- **Articles** are shorter than videos (the coverage set's longest takes 27 minutes to read), so
  the whole text goes in. The article paragraphs already have numbers (`articleParagraphs`), so
  they are the passage ids, and a citation points at a paragraph. **Podcast episodes** have timed
  segments, so they work as videos do.

### Whose key, and the quota

- **Our key, on GPT-6 Luna, for every plan.** The same provider as our overviews, so no new third
  party. Plus readers get Sol for overviews, but not for chat: on this evidence Sol costs 17 times
  as much for no better answers.
- **Its own counter, never the overview quota.** OV-224 asked whether chat counts against
  overviews. It shouldn't: a Luna message costs about a hundredth of a Sol overview, so counting
  one against the other would be nonsense. A server-counted monthly message allowance per plan,
  in Postgres as `overview_usage` is (`tiers.md`, "Counting"):
  - the allowance differs by plan, because plans sell volume, never features (`tiers.md`), so
    every plan has chat;
  - Free 100 messages a month, BYO Plus 500, Plus 1,000 (the owner confirmed these on 16 Nov
    2026). Fully used, that's about $0.03, $0.17 and $0.34 a month at this set's mix, $0.05,
    $0.27 and $0.53 on long videos, and $0.10, $0.52 and $1.04 with no caching at all;
  - a daily cap per account behind it, and a share of the global daily cap on our key;
  - a limit per conversation, say 30 messages, to bound history;
  - never "unlimited".
- **At a limit, the reader waits; it isn't a failure.** The same pattern as the capture queue: say
  when it resets. A provider rate limit retries quietly, and the reader sees "still thinking", not
  an error.
- **The reader's own key, later.** Running chat from the device on the reader's key is free to us
  and possible: the device holds the transcript. But it adds the multi-turn calls to all six
  providers' adapters, and the answers would depend on the reader's model, which this spike didn't
  measure. Add it if own-key readers ask for it.
- **Signed out: none.** There is no account to keep a conversation, and onboarding's single
  overview is the wrong place to spend.

### Chats as records

- **A synced kind, `chat`, one record per conversation** in `records` (`sync-api.md`). It holds the
  overview id, the messages (who, text, time) and each answer's citations as `{ passageStartMs,
  passageEndMs }`, or paragraph numbers for an article, all worked out by code from the cited ids.
  It is never stored on the overview record, which is replaced wholesale on regeneration: the read
  and favourite lesson (`CLAUDE.md`).
- **Written by the server.** The answer comes from our server, so it appends both messages and
  the reader's devices get the record through the feed. The client's local store holds it as it
  holds other kinds.
- **Tombstoned with its overview,** in the same transaction, as `overviewState` is ("Deletes are
  tombstones, and an overview takes its state with it"). **Deleted with the account** at no extra
  cost, because `records` already cascades (`account-deletion.md`). A reader can delete a single
  conversation.
- **A regenerated overview keeps its chats.** Their citations point at moments in the video,
  which don't move. Since OV-319 an answer can also cite the overview's own items (a step, How
  to apply, a dubious reason, the verdict, a chapter), and those can move when it is made again:
  each keeps its place and a hash of its text, so a moved item is followed and a rewritten one
  falls back to its section (`chats.md`, "Citing the overview").
- **Several chats per overview, and one can use another.** The owner asked for this on 16 Nov 2026. Each question also carries the overview's other live chats, cut to a budget measured by
  code with the oldest dropped first, so a reader can build on an earlier decision without
  repeating it. An answer that uses one cites the message, `{ chatId, message }`, which code
  checks against a live chat of the same overview. An earlier answer is context, not evidence:
  a fact about the source still cites the source, and an answer resting only on another chat is
  not "in the source". The citation shape went into OV-308, so it needs no schema bump later.
- **Notes**, the reader's own writing on an overview (a separate card the owner wants), should be
  the same shape: a per-overview reader record, synced, deleted with the overview, read by the
  same tools. Chats and notes sit side by side on the overview.

### Chats over MCP

- **`list_chats`**, by overview or project: each conversation's id, overview, first question,
  message count and last time. **`get_chat`**: one conversation, with each citation as a timestamp
  link (`youtubeTimestampUrl`), so an assistant can cite it the way it cites an overview.
- **Under `overviews:read`, with no new scope.** A chat is part of the overview it belongs to, and
  `get_overview` already serves the reader's own words under that scope ("Why I saved it"). A new
  scope would leave every existing connection unable to read chats until it reconnects, and
  would ask a new reader to consent to something they haven't seen yet. `profile:read` is
  separate because the profile is learned about the reader across everything, which a chat isn't.
- **`get_overview` says that chats exist,** in one line with their ids, so an assistant knows to
  call `get_chat`.
- **No assistant writes to a chat.** A chat is the reader's conversation, and an assistant that
  wants to discuss the overview has its own conversation. This agrees with the card's lean.

### What has to change when it's built

- **The privacy page** (`legal-pages.md`, "Does this change the texts?"):
  - a new thing stored about the reader (their questions and the answers);
  - what our key sends to OpenAI (the transcript and the question, for chat as well as for
    overviews);
  - how long chats are kept (until the reader deletes them, their overview or their account);
  - a retention table row.
- **The terms**: a new allowance readers can see.
- **This PR changes neither.** It adds a doc and a local harness, and nothing in the app collects,
  sends or stores anything new.

## The decision: build, small, with OV-266's questions as the way in

- **Build** chat about one overview, on our key, on Luna, with the whole transcript and a message
  allowance on every plan.
- **OV-266's questions are the way in.** A tap answers in the app, with "continue in Claude" (or
  ChatGPT) beside the answer for anyone who wants to go further on their own assistant. The
  question chips need a Design round anyway, so chat and chips can be designed together.
- **OV-233 (Explore further)** is answered by this and OV-266 together. Close it when the build
  cards exist.

**Why build now rather than wait for evidence from testers.** The thing that made in-app chat look
wrong was the bill. At $0.10 for a heavy month, chat is in the same class as an embedding, which
the position already accepts. Most readers may never connect an assistant (OV-235's own risk), and
for them the alternative is no way to ask at all. The case for waiting is real, though: there are no
readers yet, so whether anyone wants chat is unknown. That is why the build is the smallest one that
can answer that question.

### OV-235's exception test, as this proposes to change it

OV-235 hasn't written its decision yet. Its card suggests the rule is a middle ground: reasoning we
pay for when it is bounded and cheap, never when it is open-ended. This report proposes making that
the test, measured:

> We pay for reasoning ourselves only when it is **bounded to one thing the reader saved**,
> **answers only from it** and declines the rest, and **costs a small fraction of an overview** per
> reader-month at heavy use, counted by the server. Anything open-ended (across the library, from
> the web, or with no limit on volume) stays rented, in the reader's own assistant.

Chat about one overview on Luna passes all three: one source, 24 of 24 unanswerable questions
declined, about three overviews' worth at 300 messages. Chat across the library fails the first.
Chat on Sol fails the third.

### Build cards

The owner said build on 15 Nov 2026. Cards 1 to 4 are on the board as OV-308 to OV-311, in this order:

1. **Chat records (OV-308):** the `chat` kind, its schema and record version, tombstoned with the
   overview, sync and the local store, and the privacy page and retention table.
2. **The chat endpoint on our key (OV-309):**
   - `POST /api/chats/:overviewId/messages`, Luna, the account's own transcript (or article text)
     in a cached system prompt, the passage-id citations turned into times by code, and streamed
     answers;
   - the overview's other live chats sent with each question, cut to a budget by code, and their
     citations checked against real messages;
   - the monthly allowance, the daily caps and the per-conversation limit, counted in Postgres;
   - limits shown as waits;
   - analytics: messages and tokens per message, never the text.
3. **Design, then the chat panel (OV-310):** a Claude Design round for web, phone and the 400px panel,
   with OV-266's chips as the way in, the list of an overview's chats, and a citation of another
   chat shown as a link to its message. Then the UI, with streaming text announced politely and full
   keyboard use.
4. **Chats over MCP (OV-311):** `list_chats`, `get_chat`, and the line in `get_overview`.
5. **Later, only if asked for, and not carded:** chat on the reader's own key from the device; chat across a
   project.
6. **Before any chat across sources, an investigation (OV-307, already on the board):** does claim search pick the right
   sources? Measure, in code, how often OV-229's claim search puts the source that answers a
   question in the closest few, by question kind, over a whole library. Then price and score
   "closest overviews plus their whole transcripts" against passage vectors, using this harness.
   Passage vectors are built only if `transcriptOnly` questions miss their source often.
   Done 20 Nov 2026: see "Chat across sources" below.

## Chat across sources

OV-307, an investigation, 20 November 2026. On 19 Nov the owner asked for chat that reaches
beyond one overview. The motivating case: in a recipe's chat, ask how the healthy eating swaps
from their saved overviews apply to the recipe. They also asked for two more cases: overviews the
reader pins with "@", as Recall does, and an empty chat over the whole library ("tell me the key
common factors across all my cards"). Recommendation 1 is built (OV-355, `docs/features/chats.md`,
"Other overviews"), and so is recommendation 2 (OV-353, "Library and project chat"); the rest isn't yet.

### The answer

- **Asking from one overview about others works with claim search alone, and the others' overviews
  are enough.** All 10 "apply my other saved overviews to this" questions found the right overview
  in the closest 3 and cited it in every arm. A first message costs about $0.0018 against $0.0009
  for today's chat, and a follow-up about $0.00025. No new embeddings are needed.
- **A detail only a transcript holds needs transcript text.** Overviews alone answered 7 of 67
  such questions. The closest 3 overviews with their whole transcripts answered 54 of 68, missing
  exactly where search missed, for $0.0045 a message. Claim search's closest 3 plus the 8 closest
  transcript minutes by passage vector answered 63 of 65, for $0.0021.
- **Keyword search over the transcripts we already keep finds what claim search misses, with no
  vectors.** Claim search or keywords put the right source in the closest 3 for all 78 answerable
  questions, as passage vectors did. A stored full-text index is about a sixth of passage vectors'
  size, or nothing if computed per question. Sending the 8 best keyword minutes answered 59 of 66
  detail questions for $0.0026. That's better than whole transcripts and a little behind passage
  vectors: it finds the source, but sometimes not the minute that holds the answer.
- **Pinning works.** With the right overview pinned among 2 or 7 near misses, answers still cited
  the right one and set where overviews disagreed apart (`pinned3`, `pinned8`).
- **Projects work too, measured on the owner's four.**
  - **"@" a project:** a project of up to 8 overviews goes in whole. A larger one sends its closest
    5 whole and the rest in brief. It picked the same sources as sending everything, at up to a
    sixth of the cost.
  - **A project page's chat:** whole overviews while the project is small, which covers recipe
    projects, whose map entries are only titles. Past that, the compact map plus keyword minutes,
    which answered 6 of 6 details at 81 overviews for $0.0013.
- **An empty chat over the whole library works from a compact library map.** That's every overview's
  title, big picture and core claim, about 16,000 tokens for this library, sent whole. It found every
  core overview the questions needed, cited nothing off the subject, and never invented an
  overview, for about $0.0016 a first message and $0.0004 cached. Broad questions ran past the
  1,000-token answer cap and failed 5 times in 8.
- **The decision:** build in three steps. First, claim search plus pins in an overview's chat,
  overviews only. Second, the library map as its own chat. Third, keyword search over the kept
  transcripts as a second pass, with the matching passages sent. Passage vectors aren't needed on
  this evidence (below).

### How it was measured

`apps/api/src/scripts/exportChatLibrary.ts` read the owner's library from production over a
connection opened read only at the server (`default_transaction_read_only`, checked before the
first query): 208 live overviews, all embedded at their current rev (1,420 claims), and 167 kept
transcripts, 69.4 hours in all. The longest was 4h03. `chatAcrossSourcesCheck.ts` loads the export
into the in-memory Postgres with pgvector the tests use. **Search is `ClaimEmbeddingsRepository.closest`,
the production query, with `MEANING_FLOOR`**, and each question is lowercased as `MeaningSearch`
does. Answers use the production pieces: `chatSystemPrompt` for the overview the chat is about,
`streamChatCompletion` on Luna with the `ChatReply` schema, and `transcriptPassages`. The other
sources go in as one user message after the cached system prompt (the OV-313 lesson), labelled
S1, S2 and so on, with their ids prefixed (`S2.kp3`, `S2.p14`). Code turns cited ids back into
overviews and moments.

**The questions, 94 in all, placed by code:**

- OV-267's 36, on its six sources.
- 44 new ones on 11 more sources: one the overview answers, two only the transcript answers, and
  one needing two moments at least a quarter of the source apart. These include the 2h00, 2h22 and
  4h03 sources, and near neighbours that make search harder (two stress overviews, collagen and
  peptides, several parenting ones).
- 10 "apply" questions asked from one overview about another, six of them from recipes about the
  healthy eating podcast.
- 4 questions nothing in the library answers (vitamin D, fasting, salary, sauna). Code checked that
  no overview mentions them.
- 6 synthesis questions for the library map.

Every quote was located in its transcript by code. Each lookup question is asked from a chat
about another overview: for the 80 source questions, the overview nearest the answering one by
best pair of claims, and for the apply questions, the overview named. The answering overview is
never the chat's own. Claude wrote the questions. The new ones name their subject
("the dermatologist who took collagen"), which makes search easier. OV-267's say "she" with no
name, which makes it harder.

**Prices** are `modelPrices.ts`, checked 9 Nov 2026: Luna $0.10 in, $0.01 cached, $0.50 out per
million, and `text-embedding-3-small` $0.02. The run spent **$0.02 on embeddings and $4.42 on
answers**, on the evals key, plus $0.49 for the keyword arm (`search3+keyword8`), which ran
afterwards and finished both runs. Each arm had a budget, and nine reached it short of a full second
run: every arm ran each question once, and 73 to 92 of the 94 a second time. The missing second
answers are the last questions in the order, mostly the apply and unanswerable ones. A cached
follow-up is the measured prompt re-priced at the cached rate. A real follow-up only gets that
rate when the extra sources stay the same, which holds for pins and holds for search when the new
question finds the same overviews.

### Does search find the source?

How often the answering overview was in the closest few, for 78 answerable questions:

| Kind           | Questions | Claims: closest 3 | 5   | 8   | Keywords: 3 | 5   | 8   | Claims or keywords: 3 | Passage vectors: 3 | 5   | 8   |
| -------------- | --------- | ----------------- | --- | --- | ----------- | --- | --- | --------------------- | ------------------ | --- | --- |
| inOverview     | 17        | 17                | 17  | 17  | 17          | 17  | 17  | 17                    | 17                 | 17  | 17  |
| transcriptOnly | 34        | 27                | 28  | 28  | 32          | 33  | 33  | 34                    | 34                 | 34  | 34  |
| twoMoments     | 17        | 16                | 17  | 17  | 17          | 17  | 17  | 17                    | 17                 | 17  | 17  |
| applyAcross    | 10        | 10                | 10  | 10  | 9           | 9   | 9   | 10                    | 10                 | 10  | 10  |
| All            | 78        | 70                | 72  | 72  | 75          | 76  | 76  | 78                    | 78                 | 78  | 78  |

"Claims or keywords: 3" counts a question as found when the source is in either list's closest 3,
so up to 6 sources.

- **Claim search misses details, and naming the speaker doesn't help.** Six `transcriptOnly`
  questions fell below the floor altogether. Two of them named Rupy Aujla, such as where he
  learned to grate walnuts over food. A speaker's asides aren't in any claim. Passage vectors
  ranked all six first or second.
- **Keyword search ranked all six first.** It's BM25 over the same one-minute passages of the kept
  transcripts, with a source scoring as its best passage. It drops common words and a plural "s",
  and no model is called (`chatAcrossSourcesCheck.ts keyword`). It's weaker where claims are strong:
  it missed one apply question, which asks about "my saved healthy eating overview" in words the
  podcast doesn't use. The two kinds of search cover each other's gaps. Two of the six were
  OV-267's nameless "she" questions. The others named a speaker or a number, which suits words
  well, so readers' own questions might suit keywords less.
- **The floor doesn't tell "nothing here" from a match.** The four unanswerable questions' best
  claims scored 0.35 to 0.36, above the 0.3 floor, against a median of 0.53 for the right source.
  As OV-229 found, the closest few always return something, so declining rests on the model.
- **Passage vectors for this whole library cost $0.02 to make**, 4,112 one-minute passages.
  Storing them is the larger cost (below).

### What each index would store

Measured on 20 Nov 2026. Prod's database is 32.7 MB in all. Its claim vectors take 13.9 MB for
1,535 rows, **about 9.1 KB a vector** with row and index overhead, half as much again as the raw
6 KB. Every kept transcript together is 4.9 MB. For this library's 69 hours, measured in the
in-memory Postgres (its vector rows, 8.4 KB, agree with prod's):

| Index                                                            | Size    | Per hour of video | Paid plan, $0.35 per GB-month |
| ---------------------------------------------------------------- | ------- | ----------------- | ----------------------------- |
| Passage vectors, `vector(1536)`                                  | 34.7 MB | 0.50 MB           | $0.012 a month                |
| Passage vectors, `halfvec(1536)`                                 | 17.7 MB | 0.26 MB           | $0.006 a month                |
| Full-text index (`tsvector` and a GIN index)                     | 6.1 MB  | 0.09 MB           | $0.002 a month                |
| Full-text, worked out per question from transcripts already kept | 0       | 0                 | 0                             |

- **The bill isn't the problem; the free plan's cap is.** Neon's free plan holds a project to 1 GB
  and blocks writes past it (neon.com/pricing, updated 4 Nov 2026). Passage vectors for about 25
  libraries this size would fill it. Moving to Launch then costs mostly compute, which Neon puts at
  about $15 a month for a small database, not storage. Growth will bring that move anyway, but
  passage vectors would bring it forward.
- **Passage vectors are about seven times the size of the transcripts they come from.** A minute of
  compressed text is small, and 1,536 numbers aren't.
- **Reading them costs time too.** Search compares a question with every one of the reader's rows,
  with no index. That's 1,420 claim rows for this library today, and passage vectors would add
  4,112 rows and about 35 MB per question. Probably fine, but unmeasured, and an index would add
  storage.
- **Keyword search needs little or nothing.** Postgres can rank the kept transcripts per question
  with no new storage, at some query time. A stored index is about a sixth of passage vectors'
  size.

### Cost and quality per shape

Every arm adds sources to today's chat about one overview. "Overviews" means their overviews only;
"full" adds their whole transcripts. Medians over every answer, both runs:

| Arm                       | What goes in                                                    | Prompt tokens | First message | Cached follow-up | Latency |
| ------------------------- | --------------------------------------------------------------- | ------------- | ------------- | ---------------- | ------- |
| home                      | today's chat, nothing added                                     | 6,683         | $0.00092      | $0.00013         | 2.0 s   |
| search3-overviews         | claim search's closest 3                                        | 13,209        | $0.00177      | $0.00025         | 2.9 s   |
| search5-overviews         | closest 5                                                       | 16,390        | $0.00219      | $0.00028         | 2.9 s   |
| search3-full              | closest 3, whole transcripts                                    | 35,363        | $0.00452      | $0.00048         | 2.7 s   |
| search3+passages8         | closest 3, plus the 8 closest transcript minutes in the library | 16,181        | $0.00214      | $0.00029         | 3.2 s   |
| search3+keyword8          | closest 3, plus the 8 best keyword-matched minutes              | 18,842        | $0.00256      | $0.00032         | 2.8 s   |
| pinned1-overviews         | the right overview, pinned                                      | 9,345         | $0.00127      | $0.00021         | 2.7 s   |
| pinned3-overviews         | it, plus 2 near misses                                          | 13,209        | $0.00178      | $0.00025         | 2.8 s   |
| pinned8-overviews         | it, plus 7 near misses                                          | 20,946        | $0.00271      | $0.00032         | 3.0 s   |
| pinned3-full              | 3 pinned, whole transcripts                                     | 36,311        | $0.00482      | $0.00049         | 3.0 s   |
| pinned1+search3-overviews | the pin, plus search's 3                                        | 13,209        | $0.00174      | $0.00025         | 2.9 s   |

What each answer cited. Each cell is: cited the answering overview, cited the right moment, named
the expected detail.

| Arm                       | inOverview            | transcriptOnly        | twoMoments            | applyAcross       |
| ------------------------- | --------------------- | --------------------- | --------------------- | ----------------- |
| home                      | 0/34 · — · 2/34       | 0/68 · — · 0/68       | 0/34 · — · 2/34       | 0/20 · — · 9/14   |
| search3-overviews         | 34/34 · — · 34/34     | 7/67 · — · 4/67       | 29/33 · — · 25/33     | 10/10 · — · 7/7   |
| search5-overviews         | 33/33 · — · 32/33     | 7/65 · — · 4/65       | 30/32 · — · 26/32     | 10/10 · — · 7/7   |
| search3-full              | 34/34 · 34/34 · 34/34 | 54/68 · 52/68 · 55/68 | 32/34 · 26/34 · 31/34 | 10/10 · — · 7/7   |
| search3+passages8         | 33/33 · 30/33 · 33/33 | 63/65 · 56/65 · 58/65 | 32/32 · 16/32 · 27/32 | 9/9 · — · 6/6     |
| search3+keyword8          | 34/34 · 26/34 · 34/34 | 59/66 · 52/66 · 55/66 | 33/33 · 13/33 · 29/33 | 18/18 · — · 13/13 |
| pinned1-overviews         | 34/34 · — · 34/34     | 6/67 · — · 2/67       | 32/34 · — · 26/34     | 20/20 · — · 14/14 |
| pinned3-overviews         | 33/33 · — · 32/33     | 7/66 · — · 5/66       | 31/33 · — · 25/33     | 10/10 · — · 7/7   |
| pinned8-overviews         | 33/33 · — · 32/33     | 7/64 · — · 5/64       | 30/32 · — · 27/32     | 10/10 · — · 7/7   |
| pinned3-full              | 34/34 · 33/34 · 34/34 | 65/66 · 59/66 · 65/66 | 33/33 · 24/33 · 31/33 | 10/10 · — · 7/7   |
| pinned1+search3-overviews | 34/34 · — · 34/34     | 10/67 · — · 4/67      | 31/34 · — · 26/34     | 16/16 · — · 13/13 |

- **Today's chat can't do any of this.** It cited nothing outside itself, as it should. On the
  recipe questions it either said "the recipe page doesn't include the rule from your healthy
  eating overview" or answered from general knowledge.
- **For advice, overviews are enough.** Every search and pinned arm cited the right overview on all
  apply questions. On the cookies, for example: "Your saved healthy eating overview's rule is under
  5g added sugar per 100g… these cookies are very likely to exceed that." That's the owner's case,
  at about twice today's price.
- **For a detail, the transcript has to be there.** Overviews alone answered about a tenth of
  `transcriptOnly` questions. Whole transcripts of the closest 3 cost two and a half times as much,
  and still lose what search misses. The 8 closest passages found more for half the price. They
  are worse at two-moment questions (16 of 32 moments), because only the closest minutes go in.
- **Keyword minutes come close to passage vectors.** They answered 59 of 66 detail questions
  against 63 of 65, and cited the right moment 52 times against 56. They cost $0.0026 a first
  message against $0.0021, because the matched minutes spread over more sources. In all seven
  misses the right overview was in the prompt, but the minute holding the answer wasn't among
  the eight sent, so the answer said, rightly, that nothing it was shown covered it. The likely
  reason is that the question's words aren't the answer's: "which drug did she keep asking the
  nurse for" never says "potassium". Meaning finds that minute; words can't. Declining held as
  well: 8 of 8 unanswerable answers cited nothing.
- **Pins don't confuse it.** Seven near misses beside the right overview changed nothing that was
  measured. Answers named each pinned overview by title and said where they differed, for example
  Becky Kennedy's repair against Erica Komisar's presence.
- **It declines what nothing covers.** Across the arms that added sources, 37 of 38 answers to the
  four unanswerable questions cited nothing and said none of the overviews shown covered it. The
  38th said the same, and then cited a pinned football training overview for the recovery
  practices it does cover, which is fair. OV-267's 24 unanswerable questions sometimes cited
  their own source for the part it covers and then said it doesn't cover the rest, which is right.
- **Failures are cut-off answers.** Every failed call, 1 to 3 per arm out of about 170, was an
  answer that ran past `MAX_ANSWER_TOKENS` (1,000), so its JSON was cut off. More sources make longer
  answers. The cost of a cut-off answer isn't reported, so it counted as $0 here.
- **Ids leak into the text.** Some answers wrote "(S2.kp1; S3.kp4)" into the prose.
  `withoutCitationMarks` knows only unprefixed ids, so the labelled form has to be added.

### An empty chat over the whole library

The library map: each overview's id, title, big picture and core claim, or the same plus every key
point, in one cached system message. Six questions, twice each:

|                                                  | Compact map     | Map with key points                                                |
| ------------------------------------------------ | --------------- | ------------------------------------------------------------------ |
| Prompt tokens                                    | 16,122          | 77,061                                                             |
| First message (uncached)                         | about $0.0016   | $0.0100 (measured)                                                 |
| Each later message, cached                       | $0.0003–$0.0006 | about $0.0010                                                      |
| Core overviews found (stress, parenting, eating) | 16/16           | 15/16                                                              |
| Cited overviews on the subject                   | every one       | 2 of 3 on stress (added a productivity video), otherwise every one |
| Ids not in the library                           | 0               | 0                                                                  |
| Cut off at 1,000 tokens                          | 3 of 12         | 3 of 12                                                            |

The cut-off answers were all "the key common factors across everything I've saved" and "which of
my saved overviews disagree". The compact map answered the parenting question with the shared idea,
Komisar standing apart, and the two "three kids" videos as practical rather than advice. Key points
cost five times as much and added nothing measured. Code can check citations but not whether a
synthesis is good, so the answers are in the run for reading.

### A project: its own chat, and pinned with "@"

On 20 Nov the owner asked whether this covers a project, either pinned with "@" in an overview's
chat or as a chat on the project page. We ran it on their four real projects from a second
read-only export: Dessert Recipes with 5 overviews, Dinner Recipes 21, Software Engineering with
AI 39, and Building tech products 81. Each project got 5 or 6 questions:

- a synthesis question, such as "the key common factors across the apps in here that make money";
- a detail held in one overview, such as the Italian Cream Cake's oven temperature or Cardstock's
  revenue;
- a question about the project's purpose, such as "given what this project is for, what should my
  first month look like?";
- a question the project can't answer.

There were also 4 "@" questions asked from an overview's chat, such as asking from Dr Rupy's
healthy-eating video "which recipes in my Dinner Recipes project best fit this advice?". The run
cost $0.28. The compact map and "@" shapes ran twice, and the whole-overview shapes once.

**A project page's chat**, as first message cost and results by project size:

| Shape                                                          | 5 (recipes)        | 21 (recipes)    | 39              | 81              |
| -------------------------------------------------------------- | ------------------ | --------------- | --------------- | --------------- |
| Whole overviews, with purpose                                  | 4k tokens, $0.0006 | 16k, $0.0022    | 81k, $0.0105    | 152k, $0.0191   |
| Compact map, with purpose                                      | 0.4k, $0.0001      | 0.6k, $0.0002   | 4k, $0.0007     | 7k, $0.0010     |
| Compact map + 8 keyword minutes from the project's transcripts | 0.5k, $0.0002      | 2.4k, $0.0004   | 6k, $0.0010     | 9k, $0.0013     |
| Detail questions answered: whole / map / map + keywords        | 2/2 · 0/4 · 1/4    | 2/2 · 2/4 · 2/4 | 2/2 · 2/4 · 4/4 | 3/3 · 4/6 · 6/6 |

- **Whole overviews answer everything, and are cheap for small and recipe projects.** Every
  detail was right, and the jollof question compared all three recipes by stock, base and method.
  The compact map is the wrong tool for recipes: a recipe overview has no big picture or core
  claim, so its map entry is just its title. On the map, every recipe detail and the jollof
  comparison came back as "the project doesn't say". That reply is honest, since none was made
  up, but it isn't useful.
- **Large projects need the map plus keyword minutes.** At 81 overviews the map with keyword
  minutes answered 6 of 6 details, against 4 of 6 for the map alone, at a fifteenth of the cost of
  sending everything whole. It found the same core overviews for synthesis questions as the whole
  shape did.
- **The reader's purpose made no difference we could measure.** The purpose answers with and
  without it named the same overviews and gave the same advice. It costs about 40 tokens, so send
  it anyway: it is the reader's own framing, and it may matter for vaguer questions than ours.
- **Unanswerable questions were all declined** by every shape. No answer named an overview that
  isn't in the project.
- **Broad questions on the 81-overview project hit the 1,000-token cap**, as the library map did:
  2 or 3 in 12 per shape. Twice, the whole shape stated a count ("all five recipes", "your three
  recipes"), which breaks the never-count rule (`constraints.md`). The map shapes never did.

**"@" a project in an overview's chat.** For a project of up to 8 overviews, every overview went in
whole, as with pins. A larger project sent its 5 closest by claim search in full and listed the
rest in brief, cited by label:

| Project pinned                                                        | Capped: closest 5 whole + the rest in brief | Every overview whole |
| --------------------------------------------------------------------- | ------------------------------------------- | -------------------- |
| Dinner Recipes (21), from Dr Rupy                                     | 17k tokens, $0.0025                         | 28k, $0.0040         |
| Software Engineering with AI (39), from "Why Software Factories Fail" | 20k, $0.0028                                | 87k, $0.0112         |
| Building tech products (81), from "All Code Is Slop"                  | 25k, $0.0035                                | 158k, $0.0201        |

The capped shape picked the same pushback sources as the whole shape, including some it saw only
in brief, and cited them by label. On Dr Rupy it chose the lentil curry and the bean stew for the
"beans every day" reflex. Sending everything whole cites item ids more precisely and costs up to
six times as much. One question, Dr Rupy against Dessert Recipes, failed on every attempt in both
shapes with an empty reply, and we didn't find out why. The build should log empty replies.

### Structured answers, and reading the chosen overviews whole

The owner shared one of Recall's library answers ("tell me something novel that connects my cards")
and asked for answers in that shape. It has an intro, sections with headings, points that each
carry their sources (one title shown, "+2" for the rest), and a takeaway. Recall's trace also
shows a "synthesizing cards" step before the answer. We tried both on 17 synthesis and purpose
questions: the six library-map questions, Recall's "something novel" question, and the project
ones above. Each ran once, for about $0.05 in all.

- **Structured, one pass:** the compact map (the library's or the project's) with a structured
  schema: `intro`, `sections[{heading, points[{text, sources}]}]`, `takeaway`, capped at 2,000
  tokens.
- **Two passes:**
  1. Given the same map, the model picks up to 5 overviews whose full notes it needs.
  2. Code sends those overviews whole after the map, in the same cached conversation.
  3. The model answers in the same structured shape and can cite items (`O12.kp3`).

|                                                    | Structured, one pass | Two passes                         |
| -------------------------------------------------- | -------------------- | ---------------------------------- |
| Cost a question (median)                           | $0.0004              | $0.0019                            |
| Core overviews found                               | 13/22                | 20/22                              |
| Points                                             | 52                   | 85                                 |
| Points with no valid source                        | 0                    | 0                                  |
| Points that barely share words with what they cite | 9                    | 0                                  |
| Ids that don't exist (dropped in code)             | 0                    | 3                                  |
| Cut off                                            | 0                    | 0, once the picking cap was raised |
| Latency (median)                                   | 6.6 s                | 12.4 s                             |

- **The second pass is what makes answers specific.** On one pass, the jollof comparison and "where
  do these disagree about software factories" found none of their core overviews (0/3 and 0/5),
  because a map entry is too thin to compare. With two passes both found all of them. Answers
  cited key points and steps, such as Linear's daily feedback briefing, rather than core claims.
  On one pass, 9 points shared under a quarter of their words with what they cited. Most were
  generic advice, and some were the model's own connections, which it labelled as such. With two
  passes there were none.
- **Pass 1 picked well:** the overviews it chose held 20 of 22 core overviews. The picking cap must
  allow for Luna's reasoning. At 300 tokens, 4 of 17 broad questions were cut off while picking. At
  1,000 none were.
- **Points citing several overviews worked:** 50 of 85 points cited two or more, as Recall's
  "+2" does. Recall's food-matrix point, citing Katie Dill and Dr Rupy, is that kind of point.
- **It holds the house rules:** no answer gave a count. When the model connected overviews in a
  way they don't, it said the connection was its own. Ids that don't exist are dropped in code,
  so a point never shows a wrong source.
- **Cost:** about $0.0019 a question against $0.0016 for today's plain map answer. That's
  $0.0004 cached plus the five whole overviews, which change with each question. It's well inside
  the monthly range in "What it does to a reader's month", since library and project chats are
  5% of the mix.

### What it does to a reader's month

Each plan's monthly allowance (Free 100, BYO Plus 500, Plus 1,000 messages) priced by code, for
conversations of 1 to 50 questions (`MAX_CHAT_QUESTIONS`). The model is built from the run's
measured medians: each shape's prompt, its answer length (105 tokens for today's chat, about 200
with other sources, 467 from the library map), and a 25-token question.

- **History grows.** Every question re-sends the conversation so far, so the prompt grows by a
  question and an answer each time. The last prompt is the cached prefix of the next, so only
  the newest question and answer are paid at the uncached rate.
- **Uncached tokens are priced as `modelPrices.ts` does**, as cache writes at $0.125 a million
  (OV-260). With that, the model's single-question cost matches the measured first messages:
  $0.00175 against $0.00178 for search.
- **Embeddings are included.** The question's embedding is about 25 tokens, $0.0000005, on every
  search message. Passage vectors cost about $0.00029 an hour of transcript to make: this
  library's 69 hours cost $0.02 once, and 5 to 30 hours of new saves a month cost $0.001 to
  $0.009. Claim embeddings already exist.

Average cost per message, by conversation length:

| Shape                                 | 1 question | 3        | 10       | 25       | 50       | 50, sources re-chosen every question |
| ------------------------------------- | ---------- | -------- | -------- | -------- | -------- | ------------------------------------ |
| Today's chat                          | $0.00089   | $0.00039 | $0.00022 | $0.00018 | $0.00018 | —                                    |
| Search's closest 3, overviews         | $0.00175   | $0.00076 | $0.00042 | $0.00035 | $0.00034 | $0.00169                             |
| 8 pinned overviews                    | $0.00272   | $0.00113 | $0.00058 | $0.00045 | $0.00043 | —                                    |
| Closest 3 plus the 8 closest passages | $0.00213   | $0.00091 | $0.00049 | $0.00039 | $0.00039 | $0.00208                             |
| Closest 3, whole transcripts          | $0.00451   | $0.00182 | $0.00088 | $0.00066 | $0.00060 | $0.00441                             |
| Library map                           | $0.00225   | $0.00106 | $0.00065 | $0.00058 | $0.00061 | —                                    |

A month with the whole allowance used, every conversation the same length:

| Every message in this shape                           | Length | Free (100) | BYO Plus (500) | Plus (1,000) |
| ----------------------------------------------------- | ------ | ---------- | -------------- | ------------ |
| Today's chat                                          | 3      | $0.04      | $0.19          | $0.39        |
|                                                       | 10     | $0.02      | $0.11          | $0.22        |
|                                                       | 50     | $0.02      | $0.09          | $0.18        |
| Search, overviews                                     | 3      | $0.08      | $0.38          | $0.76        |
|                                                       | 10     | $0.04      | $0.21          | $0.42        |
|                                                       | 50     | $0.03      | $0.17          | $0.34        |
| 8 pinned                                              | 3      | $0.11      | $0.56          | $1.13        |
|                                                       | 50     | $0.04      | $0.22          | $0.43        |
| Passage vectors                                       | 3      | $0.09      | $0.45          | $0.91        |
|                                                       | 50     | $0.04      | $0.19          | $0.39        |
| Whole transcripts                                     | 3      | $0.18      | $0.91          | $1.82        |
|                                                       | 50     | $0.06      | $0.30          | $0.60        |
| Library map                                           | 3      | $0.11      | $0.53          | $1.06        |
|                                                       | 50     | $0.06      | $0.30          | $0.61        |
| **Mix: 70% today's, 20% search, 5% passages, 5% map** | 3      | **$0.05**  | **$0.26**      | **$0.52**    |
|                                                       | 10     | **$0.03**  | **$0.15**      | **$0.29**    |
|                                                       | 50     | **$0.02**  | **$0.12**      | **$0.25**    |
| Search, sources re-chosen every question              | 50     | $0.17      | $0.85          | $1.69        |
| Whole transcripts, sources re-chosen every question   | 50     | $0.44      | $2.20          | $4.41        |

- **Longer conversations are cheaper per message, not dearer.** The history grows, but it is read
  from the cache at a tenth of the price. A 50-question conversation costs about half as much per
  message as a 3-question one, for every shape. So the 50-question cap bounds a conversation's
  cost; it doesn't raise it. Short conversations are the expensive case. Each new conversation
  pays to write its prompt once.
- **How sources change mid-conversation matters more than which shape is chosen.** If each
  question's search result replaced the sources block, the block and the whole history after it
  would be paid again every time: about five times the cost at 50 questions. **Keep a
  conversation's sources append-only.** Overviews found by a later question go in after the
  history as a new user message, and nothing earlier changes, so the prefix stays cached (the
  OV-313 rule).
- **Fully used, cross-source chat about doubles a reader's chat bill, and it stays small.** A Plus
  reader using all 1,000 messages on the mix costs $0.25 to $0.52, about 8 to 16 overviews on Sol
  (about $0.033 each, `tiers.md`). These are ceilings for a reader who uses everything, not
  averages.
- **Real conversation lengths will come from chat records**, which keep each conversation's
  messages. The table lets the true figure be read off once they're known.
- **Not counted:**
  - Answers cut off at the 1,000-token cap, whose cost isn't reported. Raising the cap adds
    output.
  - Storage, priced separately above. It's under $0.02 a month a reader at this library's size for
    any index.

### Recommendations

The owner approved building these on 20 Nov 2026. They're carded as OV-352 to OV-355, and the card
for each step is named at its end. The Claude Design round and the UI for all of them are OV-354.

1. **In an overview's chat: claim search plus pins, overviews only (OV-355, built 20 Nov 2026).** Send the closest 3 by claim
   search (never the chat's own overview) and any overviews the reader pins with "@". They go as a
   user message after the cached prompt, in the shape measured here. A first message costs about
   twice today's. Show what was added, as Recall does, and let the reader remove it. A pinned topic
   or project that expands past about 8 overviews needs a cap, which this didn't measure beyond 8.
   Sources are append-only within a conversation: overviews found or pinned later go after the
   history, never into the earlier block, or each question pays for the history again (about five
   times the cost at 50 questions). Removing one shouldn't rewrite the prompt either: tell the
   model to set it aside, in a new message.
2. **An empty chat over the library: the compact map, read in two passes, answered in sections
   (OV-353, built 20 Nov 2026).**
   - Re-run on the shipped prompt (the harness's `shipped` arm, whole while the overviews fit):
     19 of 22 core overviews, no unknown ids, no point drifting from its sources, $0.0020 a question.
   - One answer counted ("two sources"). The rule now names that phrasing, and 3 re-runs gave none.
   - The one question below 20/22 (s-disagree) depends on where the overview sits in the map: it was
     found 2 times in 3 in the export's order, and 0 in 4 oldest saved first.
   It's its own entry point, the library or a project, not an overview's chat.
   - The model picks up to 5 overviews from the map, with a picking cap of about 1,000 tokens.
   - Code sends those whole.
   - The answer comes back structured: intro, sections of points that each carry their sources,
     and a takeaway, with a cap of about 2,000 tokens.
   - Code turns ids into title chips (the first title plus "+n", as Recall shows them) and drops
     unknown ids. The model never writes a title.
   - The chips and sections need a Claude Design round, as OV-319's citations did. Today's
     one-overview chat can keep its plain answer.
   - Code can work out the stats line Recall shows first ("10 cards, 7 tags"). "Never count
     overviews" stayed in the prompt (`constraints.md`), and no answer gave a count.
3. **For details: keyword search over the kept transcripts, not passage vectors, for now (OV-352,
   built 20 Nov 2026).** Two measurements settled the build:
   - **Neighbours:** sending each of the 8 best minutes with the minute either side cited the right
     moment in 54 of 68 answers, against 45 without, for about 14% more ($0.55 run, same day).
   - **Where the index lives:** a stored Postgres full-text index, each word weighted by its
     rarity, rather than computing per question. It ranked as well as BM25 or better, searched in
     about 120 ms even in pglite, and is 10.6 MB for this library. Computing per question would
     read all 9.5 MB of transcripts every time.
   - **Re-run on the shipped search and prompt** (`shipped-keyword` arm, $0.30): the detail named
     70 of 75, the right moment cited 50 of 68, the source given 78 of 78, every "not in your
     library" question declined, $0.0030 a first message. On the same day both harness arms named
     68 of 75.
   The original recommendation follows.
   **For details: keyword search over the kept transcripts, not passage vectors, for now
   (OV-352).** Run
   beside claim search, it found every source passage vectors found, and its 8 best minutes
   answered 59 of 66 detail questions, against 63 of 65 for passage vectors and 54 of 68 for
   whole transcripts. It needs no embeddings, and little or no storage. Passage vectors would buy
   about six more points on detail questions, which are a minority of what readers ask, for a
   per-account index seven times the size of the transcripts and an earlier move off Neon's free
   plan. Reopen them if readers' own questions, which will be vaguer than these, miss by keyword.
   `reader.chat.answered` would need a label for answers whose cited source isn't the chat's own
   to show that. A cheaper fix to try first: send each keyword minute with its neighbours, so an
   answer a minute away still goes in.
4. **Projects (OV-168).**
   - **"@" a project in an overview's chat (OV-355):** a project of up to 8 overviews goes in whole, as pins
     do. A larger one sends its closest 5 whole and the rest in brief, about $0.0035 a first
     message at 81 overviews.
   - **A project page's chat (OV-353):** send the whole overviews while they fit about 20,000 tokens, which
     covers every recipe project here. Past that, send the compact map of the project plus the 8
     best keyword minutes from its transcripts.
   - **Both:** include the reader's purpose. Use the library chat's higher answer cap.
   - **When the map is built (OV-353):** give recipes a map entry that carries their main ingredients. A
     title alone answers nothing.
5. **Not measured:** conversations longer than one question, readers' own questions, keyword
   minutes sent with their neighbours, and why one pinned-project question got empty replies.
6. **When built, it changes the privacy page:** the other overviews and passages go to OpenAI with
   the question. A stored full-text index, or passage vectors if they ever come, is new derived
   data kept per account (`legal-pages.md`).

### What found sources should be (OV-362, 22 Nov 2026)

The owner's first week of use showed Found for you adding unrelated overviews, 11 for one question.
`foundRelevanceCheck.ts` lists, for each of one reader's 51 real questions, the closest overviews by
meaning and the overviews keyword minutes come from, with their scores (production read only;
embeddings on the evals key, 892 tokens, under $0.0001). The questions and titles stay local.

- **By meaning:** unrelated overviews scored 0.33 to 0.37, and the ones worth reading 0.40 and up
  (0.42 to 0.59 for the clearest). So found sources need 0.40 (`FOUND_FLOOR`). The questions with
  nothing close now find nothing, where they used to find the nearest of the unrelated.
- **By words:** keyword scores don't separate relevant from not. An unrelated overview sharing one
  word scored 0.17 where a relevant one scored 0.14. So minutes are now searched only in the
  overviews a question reads, and words never add one.
- **Not re-measured:** the OV-352 answer arms (right moment 51/68 across sources). Their question
  sets lived in a worktree that has since been removed. A question whose detail sits only in an
  overview search by meaning doesn't find will now miss it, unless the reader pins that overview.

## Answering from the whole scope (OV-373)

OV-373, an investigation, 22 November 2026. Library and project chat read at most 5 overviews in
full (`MAX_CHAT_PICKS`), chosen from a map of titles, big pictures and core claims. A question that
covers many overviews ("what's worth reading first in my unread overviews?", which is one of our
own starters) got an answer from 5. The map also carried no read or favourite state, so the model
couldn't tell which overviews were unread. The owner asked for a general fix for every question that
draws on many overviews, not one for that starter.

### The answer

- **A plan before the answer fixes it, and reading more in full adds nothing.** The first pass
  returns filters (read, favourite, kind, topic, saved between, novelty), which code applies
  exactly; a mode (`deep` or `broad`); and picks. The map gains a line of facts per overview, and
  the reader's marks go in as a message of their own. With 5 read in full, questions that need every
  matching overview covered 345 of 371, against 17 of 333 for today's shape. Larger budgets and
  whole filtered sets covered no more, for up to twice the cost.
- **Code picks the right scope.** The plan's filters matched the expected set in 11 of 11 filtered
  questions in every arm, and no plan arm cited an overview outside it, against 14 for today's shape.
- **Deep questions get better too:** 12 of 12 core overviews against 10 of 12.
- **Broad answers are long.** They ran up to 7,800 output tokens. 4 of 14 went past today's
  4,000-token cap, so a broad answer needs a cap of its own (16,000 here).
- **Slower:** a median 30 seconds against 14, and up to 70 for a ranking of 89 overviews.
- **The decision:** build the plan with 5 read in full. The second slice brings facts on the map, the
  marks message, the plan with code-applied filters, a broad answer that places every match, a
  separate cap for broad answers, and a stat line counted by code ("Looked across 112 unread · read
  5 in full"). Charging more for a broad answer is OV-376: allowance as usage, weighted by cost.

### How it was measured

`exportChatLibrary.ts` now also exports overview states and topics. It read the owner's library from
production over the same read-only connection: 223 overviews, 112 unread, 38 favourites,
13 topics. `wholeScopeChatCheck.ts` asks 14 questions through four arms on Luna, once each, with
`prompt_cache_key` per arm:

- **`shipped`:** today's production material, `libraryChatMaterial` in map mode, `PICK_SHAPE`,
  `pickedBlock` and `SECTIONED_SHAPE`.
- **`plan5`:** the facts map (about 29,700 tokens against 24,400), the marks message, the plan
  schema, then 5 picks read in full and the scope code kept.
- **`plan-budget`:** the same, reading up to 20 picks within 40,000 tokens.
- **`plan-whole`:** the same, reading the whole filtered set in full when it fits 300,000 tokens.

**The questions.** There are 7 filtered (unread, favourites, a kind, a month, novelty, and
combinations), 3 on a topic, 1 ranking and 3 deep. Each filtered, topic or ranking question carries
the filter that defines its expected set, and code applies it, so what an answer should cover is
never a model's judgement. Each deep question carries 4 core overviews. Claude wrote the questions
from the library's facts. They and the titles stay local (`packages/model-comparison/.local`).

**Scoring is code:** covered (expected overviews any source cites, for questions that want them
all), cited outside the expected set, whether the plan's scope equals the expected set, core found,
ids that don't exist, and the count pattern the prompt forbids.

**Cost:** $0.32 on the evals key. Four answers timed out at 300 seconds during a slow spell at the
provider, and passed when asked again.

| Arm           | Covered (wants all) | Outside the scope | Scope = expected | Core found | Read in full | Past 4,000 output | Cost a question (median / max) | Latency |
| ------------- | ------------------- | ----------------- | ---------------- | ---------- | ------------ | ----------------- | ------------------------------ | ------- |
| `shipped`     | 17/333              | 14                | —                | 10/12      | 5            | 0 (1 cut off)     | $0.0024 / $0.0069              | 14 s    |
| `plan5`       | 345/371             | 0                 | 11/11            | 12/12      | 5            | 4                 | $0.0038 / $0.0121              | 30 s    |
| `plan-budget` | 347/371             | 3                 | 11/11            | 12/12      | 17           | 3                 | $0.0066 / $0.0149              | 39 s    |
| `plan-whole`  | 336/371             | 0                 | 11/11            | 12/12      | 29           | 4                 | $0.0084 / $0.0288              | 34 s    |

- Today's shape couldn't rank unread videos at all: it said it couldn't see what was unread. It
  covered 3 of the 112 unread on the starter, and one grouping answer was cut off at the cap.
- 22 of `plan5`'s 26 misses are one question, "which of my recipes should I cook first?". Every
  plan arm answered it with one recipe, which reads as a fair answer to an ambiguous question.
- Costs are with the map cached across questions, as follow-ups get. A first question in a new
  conversation also writes the map to the cache, about $0.003 more.

## Running it again

```
npm run chat-prepare --workspace packages/model-comparison -- fetch
npm run chat-prepare --workspace packages/model-comparison -- check
task secrets:evals -- npm run chat-retrieval --workspace packages/model-comparison
node packages/model-comparison/dist/cli/compareChat.js --run <name> --dry-run --count 8
task secrets:evals -- npm run chat --workspace packages/model-comparison -- --run <name> --budget 5 --count 8
npm run chat-report --workspace packages/model-comparison -- --run <name>
```

- `fetch` reads each source's `overview.md`, which is saved from `get_overview`, and fetches its
  transcript. Each source also needs a `questions.json`, and `check` locates every quote.
- `--dry-run` prints a rough ceiling, counting characters divided by four. The real run records
  the providers' own token counts.
- The run stops at its budget, and it carries on from where it left off when started again.

**Chat across sources (OV-307)**, from `apps/api` after a build:

```
DATABASE_URL=… node dist/scripts/exportChatLibrary.js <email> <data dir>/library        # overview-prod, read only
node dist/scripts/chatAcrossSourcesCheck.js retrieval <data dir> <data dir>/retrieval.json   # evals: embeddings only
node dist/scripts/chatAcrossSourcesCheck.js keyword <data dir> <data dir>/retrieval.json     # free: BM25 over kept transcripts
node dist/scripts/chatAcrossSourcesCheck.js answer <data dir> <data dir>/retrieval.json <out.json> --arms <arm,…> --runs 2 --budget <$> [--dry-run]
node dist/scripts/chatAcrossSourcesCheck.js answer x x <out.json> --report
```

- The data dir holds `library/` from the export, `ov267/` and `write/` (one folder per source,
  each with a `questions.json`), `cross.json` (questions asked from one overview about others) and
  `synthesis.json` (the library-map questions). It lives in `packages/model-comparison/.local/`,
  which is never committed and is kept per worktree.
- `project <data dir> <out.json> --arms <arm,…>` runs the project questions in the data dir's
  `projects.json` against the export's projects. Its arms are `project-full`, `project-map`,
  `project-map-nopurpose`, `project-map+keyword8`, `at-project` (capped past 8) and
  `at-project-full`.
- `twopass <data dir> <out.json> --arms structured-map,two-pass` runs the data dir's
  `synthesis.json` questions and the project synthesis and purpose questions as structured
  answers, in one pass or two.
- Arms are `home`, `search3-overviews`, `search5-overviews`, `search3-full`, `search3+passages8`,
  `search3+keyword8`, `pinned1-overviews`, `pinned3-overviews`, `pinned8-overviews`, `pinned3-full`,
  `pinned1+search3-overviews`, `map-compact` and `map-keypoints`. A map arm writes beside the
  output as `.map.json`.
- `foundRelevanceCheck.js questions <email> <file>` (production, read only), then `embed <file>`
  (evals), then `score <file> <out.json>` (production, read only) lists each question's closest
  overviews by meaning and by words with their scores.
- Run through `scripts/secrets.sh run` from a script with no spaces in its path: the worktree's
  path has a space, and the arguments split on it.

**Answering from the whole scope (OV-373)**, from the repo root after a build:

```
DATABASE_URL=… node apps/api/dist/scripts/exportChatLibrary.js <email> <data dir>/library   # overview-prod, read only
node apps/api/dist/scripts/wholeScopeChatCheck.js facts <data dir>                            # free: counts, topics, map size
node apps/api/dist/scripts/wholeScopeChatCheck.js run <data dir> <out.json> --arms shipped,plan5,plan-budget,plan-whole --runs 1 --budget 1 [--dry-run] [--only <re>]
node apps/api/dist/scripts/wholeScopeChatCheck.js report <out.json>
```

- The data dir holds `library/` and `questions.json`: `{ questions: [{ id, kind, question, expect,
  wantsAll, core }] }`. `expect` is the filter that defines the expected set, and `core` lists
  overview id prefixes.
- A run carries on from where it stopped. To ask again, remove the failed turns from the output.
- Relative paths, run from the repo root, passed through `secrets.sh run` without splitting.
