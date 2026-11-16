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
- **Not across the library or a project.** That is open-ended synthesis, which the connector
  already does on the reader's own plan, from `search_overviews`, `get_overviews`, `get_project`
  and `get_transcript`. Building it would need retrieval across many transcripts and would compete
  with the free connector. If testers ask for it, the project page could get its own card later.
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
- **Reopen this** if chat goes beyond one source, or if sources much longer than three hours become
  common. The code for both is in the spike.
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
  - suggested figures: Free 100 messages a month, BYO Plus 300, Plus 1,000. That's at most about
    $0.05, $0.16 and $0.53 a month on long videos;
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
  which don't move.
- **Several chats per overview, and one can use another.** The owner asked for this on 16 Nov
  2026. Each question also carries the overview's other live chats, cut to a budget measured by
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
