# Chats

OV-308, the first of four build cards for chat about one overview (OV-308 to OV-311). The
investigation behind them is OV-267, `docs/architecture/in-app-chat.md` (PR #343): GPT-6 Luna with the
whole transcript costs about $0.0003 a message, and answered only from the source.

OV-308 built the record, OV-309 the endpoint that answers and writes it, and OV-311 reading
chats over MCP. The panel inside the overview is OV-310.

## One record per conversation

A synced kind, `chat`, added at client version 22 (`sync-api.md`, "A kind a client was built
before"). Each record is one conversation. Since chat schema 4 (OV-353, client 26), a chat has an
**owner**: an overview, a project, or no one, which makes it a chat over the whole library. One
chat type serves all three; the owner decides where a chat is listed, what it is deleted with, and
how it is answered. There's room for topics later.

- **The owner is a flat field:** `overviewId` for an overview's chat, `projectId` for a project's,
  neither for the library's, never both. `chatOwner(chat)` reads it as `{ kind, id }`. It is a
  field each, not an owner object, because the device's `byOverview` and `byProject` indexes,
  the server's sweeps and MCP's filter all read the stored body as it is, unmigrated, and every
  chat written before schema 4 already carries `overviewId`.
- `id`: `chatRecordId(owner, conversationId)`. An overview's chats are the overview's id, a colon
  and the conversation's own uuid, as they always were. A project's are
  `project:<projectId>:<uuid>`, and the library's are `library:<uuid>`. So each owner's chats are
  found by the start of their ids (`chatOwnerPrefix`), as a project's membership records are
  (`projects.md`). `chatOwnerOfId` reads the owner back from an id.
- `startedAt`, the time of the first message.
- `messages`, in order. A reader's message is `{ from: "reader", text, at }`, with `sources`
  and `setAside` when the question added other overviews or took some out ("Other overviews"
  below). An answer adds `citations` and `inSource`.
- **Citations are worked out by code** from the passages the model cited, never stated by it
  (`CLAUDE.md`, "Never let a model count, measure or time anything"):
  - `{ startMs, endMs }` for a stretch of a video or episode;
  - `{ paragraph }` for an article;
  - `{ chatId, message }` for a message in another chat about the same overview, by its
    place in that chat's `messages`;
  - `{ part, index, textHash }` for an item of the overview itself, since chat schema version
    2 (OV-319, "Citing the overview" below);
  - `{ overviewId, title, item }` for another of the reader's overviews, `item` being
    `{ part, index, textHash }` or null for the overview as a whole, since chat schema version 3
    (OV-355, "Other overviews" below). It has no top-level `part`, so `"part" in citation` still
    means this overview's own item.
- **`inSource: false`** marks an answer the source doesn't back. Another chat and the
  overview are never the source: an answer resting only on them is not `inSource`. One that
  is not `inSource` but cites the overview is "From the overview" (`answeredFromOverview`);
  one that cites neither says the source doesn't cover the question, and may add general
  knowledge ("Beyond the source" below).
- At most `MAX_CHAT_QUESTIONS` (50) questions and their answers, and 10,000 characters a
  message. A conversation past its length is refused whole, so OV-309 checks the count first
  (`chatQuestionCount`) and offers a new conversation.

**Never a field of the overview.** The overview record is replaced wholesale when it is made
again, so anything kept on it would be wiped (`CLAUDE.md`, the read and favourite lesson). A
regenerated overview keeps its chats: their citations point at moments in the source, which
don't move.

## Several chats, and one using another

An overview can have any number of chats, and each can draw on the others: a reader can
build on a decision or an answer from an earlier chat without repeating it. Each question
carries the overview's other live chats (`otherChatsInPrompt.ts`), cut to 24,000 characters
counted by code: the newest messages are kept first, then laid out oldest first, each with an
id such as `c1.m3`. A deleted chat is never sent, so it can't come back through another one.

An answer that uses another chat cites it with `{ chatId, message }`, which code checks
points at a real message in a live chat of the same overview, as it checks times against the
transcript. An earlier answer is context, not evidence: a fact about the source still cites
the source. OV-310 shows the citation as a link to that message. Whether the reader can
choose what to bring in, instead of every chat seeing the others, is for its design round.

The citation is in the schema from the start, so adding it later needs no schema version
bump.

**Notes**, the reader's own writing on an overview, should take the same shape when they are
built: a per-overview record, synced, deleted with its overview.

## Other overviews

OV-355, step 1 of OV-307's recommendation (`docs/architecture/in-app-chat.md`, "Chat across
sources"). Each question in an overview's chat can bring in the reader's other saved overviews,
sent as overviews only (no transcripts; OV-352 adds keyword minutes):

- **Found:** claim search (`MeaningSearch`) runs on the question. Up to 3 of the closest that reach
  `FOUND_FLOOR` (0.40, OV-362) go in, never the chat's own overview and never one the reader set
  aside, so a question with nothing close finds nothing. On one reader's 51 real questions, unrelated
  overviews scored 0.33 to 0.37 and the ones worth reading 0.40 and up
  (`in-app-chat.md`, "What found sources should be"). Library search keeps `MEANING_FLOOR`. Search
  is on for every reader from client version 25 (`FIRST_ACROSS_SOURCES_CLIENT_VERSION`; owner,
  20 Nov 2026). Without search (no embedder, or the embedding service down) nothing is found and
  pins still go in.
- **Pinned with "@":** the request's `pins.overviews` go in whether or not search would find them.
  A pinned project (`pins.projects`) goes in whole up to 8 members; past that its 5 closest to the
  question go in whole (claim search within the project, then the most recently added) and the
  rest `brief`, as title, big picture and core claim. The UI that pins is OV-354.
- **Append-only.** What a question adds is stored on its reader message as `sources`
  (`ChatSource`: `label` S1, S2…, `overviewId`, `title`, `how`, and `projectId` and `brief` for a
  project's), and each later question rebuilds those blocks in the same places
  (`otherSourcesInPrompt.ts`), so the prompt only ever grows at its end and the history stays
  cached. An overview already in the conversation isn't sent again; one deleted since is left out
  of the rebuild and can't be cited.
- **Setting aside.** The request's `setAside` overview ids become a new message naming the labels
  and titles, stored as the reader message's `setAside`. Earlier blocks stay, and code no longer
  accepts citations of those labels. Pinning one again adds it under a new label.
- **Citations.** The model cites `S2` or `S2.kp1` in `overviewParts`; `citationsOf` turns them into
  `{ overviewId, title, item }`, copying the title from the record, and drops unknown labels and
  items. An overview listed in brief is cited as a whole. `withoutCitationMarks` strips both forms
  from the text. Another overview is never the source, so such an answer has `inSource: false`,
  and the app doesn't label it "not covered".
- **The stream** starts with a `sources` event, `{ pinned, found }`, when the question added any.
- **A client before version 25** is answered from its own overview alone, as before: no search,
  no pins, no `sources` event.
- **Search my library** (OV-354): a question with `searchLibrary: false` runs neither claim search
  nor keyword search, so only pins are read. It's stored on the question as `searchedLibrary: false`,
  so the switch is remembered per conversation on every device.
- It counts as one message of the allowance, as any question does.

## One shape for every answer

OV-354; owner, 21 Nov 2026: every chat answers in the same shape, whatever its scope (an overview,
a project, the library). They look and feel the same; only what they draw on differs. The reply
(`ChatReply`, `CHAT_REPLY_SCHEMA`, `ANSWER_SHAPE_RULES`) is:

- **an intro**, which alone answers a simple question in two to five plain sentences, with its
  sources in `introSources`;
- **sections**, only where the question has parts or the answer compares or lists. Each has a
  heading, short paragraphs, a numbered list where order matters or bullets where it doesn't, and
  `sources`: every id it rests on. A source that backs the section has an empty relation, shown as
  "Based on"; where the section compares, the relation names the side it takes in one to four
  words, cut at a word if longer (`relationOf`). Disagreement gets a section of its own;
- **list items with their own sources** (OV-362): each numbered or bulleted item is
  `{ text, sources }`, so a list of overviews has a chip after each item. The section's sources
  still list everything;
- **a takeaway**, one sentence when there are sections;
- for an overview's chat, `inSource` and `generalKnowledge`, as before.

**Citing.** A source id may be anything the chat can cite:
- a passage (`p12`);
- an item of the overview (`step2`);
- another chat's message (`c1.m3`);
- another overview or its item (`S2`, `S2.kp1`, `O3.kp2`);
- a minute of another transcript (`S2.p14`, `O3.p14`).

`structuredAnswer` cites each by code (an id it wasn't given is dropped) and stores
`{ citation, relation }` pairs on the answer's `sections` (chat schema 6, client 28), and each list
item's citations (chat schema 7, client 29). An answer stored before reads its items as citing
nothing of their own, and its "Supports" shows as "Based on" (`relationLabel`).

**Writing** (OV-362):
- No em dashes, ever. The prompt says so, and `withoutDashes` turns any it writes into a comma, in
  every stored field and in the streamed intro.
- A few key words may be bold, with `**double asterisks**`, never a heading. The app renders them.

**Text.** `text` is the flattened reading, for copy, hand-offs and the next question's history.
`citations` is the union of every source.

**Streaming.** Every chat's stream sends the intro as `text` and each section as `section`, once it
is whole. An answer stored at schema 5, as points, reads as bullets with their sources as "Supports".

**Measured on the shared shape** (21 Nov 2026, harness `own`, `shipped-keyword` and `twopass shipped`
arms, ~$0.67):

| Chat | Result | Before the change |
|---|---|---|
| An overview's own transcript (`own`) | right moment 61/68 (single moments 48/51; both of two moments 13/17); detail named 67/68 | OV-267's 46/48, on other questions |
| The same: not covered | 10 of 12 cited nothing. The other 2 cited the part the video did cover and marked the rest as general knowledge | |
| Across sources (`shipped-keyword`) | right moment 51/68, detail named 70/75 | 50/68 and 70/75, same day |
| Library and project (`twopass shipped`) | 18/22 core overviews, no unknown ids, no counts | 19/22 |

## Library and project chat

OV-353, step 2 of OV-307's recommendation (`docs/architecture/in-app-chat.md`, "Chat across
sources"). A chat over the whole library has no owner, and a project page's chat is owned by the
project. Both are answered by `LibraryChatAnswerer`, from the overviews in scope: the library's
live overviews, or the project's members that are still in it (`isInProject`), never a deleted
or taken-out one.

- **Endpoints:** `POST /api/chats/library/messages` and `POST /api/chats/projects/:projectId/messages`,
  with `{ conversationId, text }`. The refusals are an overview chat's, and both passes together
  are one message of the allowance (`reserveChatMessage`). A project that isn't held is 404, and
  a scope with no overviews yet is 422 `chat: "no-source"`.
- **Whole or map** (`libraryChatPrompt.ts`, ported from the harness and tested by its `shipped` arm):
  - Overviews are labelled O1, O2… oldest saved first, so a new save lands at the end of the
    cached prefix.
  - While their whole notes fit 80,000 characters (about 20k tokens, counted by code), they go
    whole in the system message and one pass answers. That covers small libraries and every
    recipe project measured.
  - Past that, the system message is the compact map: each overview's title, big picture and core
    claim, plus a recipe's first 12 ingredient lines, since a recipe has no claim.
  - Since OV-373 every overview, whole or on the map, also has a line of facts set by code
    (`factsLine`): kind, length in minutes, the day saved, novelty, dubious, watch it anyway and its
    topics. The map lists the scope's topics. The reader's read and favourite marks go in a message
    of their own after the system message and the history (`marksBlock`), so marking an overview
    read doesn't change the cached map.
  - A project's prompt carries its name and purpose.
- **Two passes on the map** (OV-373; measured in `docs/architecture/in-app-chat.md`, "Answering
  from the whole scope"):
  - **Pass one is a plan** (`PLAN_SHAPE`, a 3,000-token cap, since Luna's reasoning counts):
    - filters from a fixed list (read, favourite, kinds, topics, saved between, novelty);
    - a mode, `deep` or `broad`;
    - up to 5 picks.
  - **Code applies the filters** (`planScope`). A topic the scope doesn't have, or a day that isn't
    one, is dropped rather than emptying the scope. Picks outside the kept scope, already read in
    this conversation or pinned are dropped.
  - **Pass two** sends the marks, then `scopeBlock`: the kept labels when the plan filtered, and for
    a `broad` answer a line telling it to place every kept overview, not only the ones read in
    full. Then it sends the picks whole as one user message, then the question. A `deep` answer has
    `SECTIONED_SHAPE`'s 4,000-token cap; a `broad` one, and every whole-mode answer, has
    `BROAD_SHAPE`'s 16,000, since an answer placing 89 overviews ran to 7,800 tokens.
  - **A broad answer covers every overview in scope.** The prompt asks for each to appear in a list
    item's sources, grouped where they share a reason; the log line counts how many were cited
    (`scopeCited`).
  - Each question's picks are stored on its reader message (`picked`) and rebuilt in place. The
    marks and scope aren't replayed for earlier questions.
- **The answer** is `{ intro, sections[{ heading, points[{ text, sources }] }], takeaway }`:
  - Code turns each point's `O3` or `O3.kp2` into `{ overviewId, title, item }` (`overviewCitationsOf`)
    and drops unknown ids. An overview seen only on the map is cited as a whole.
  - Ids written into the text are stripped (`withoutCitationMarks` with `library`, so an
    overview chat's "(O2)" stays oxygen).
  - It is stored on the answer as `sections`; `text` is its flattened reading and `citations` the
    union.
  - `stats` (overviews in scope, and projects for the library) is counted by code. The prompt
    still says never to count.
- **The stream:** `picking`, then `picked { overviews: [{ overviewId, title }] }` on the map, then
  the intro as `text`, each `section` as soon as it is whole (`sectionsSoFar`), and `answered`, or
  `failed` for a failure in either pass.
- **Cut off at the cap:** Luna's reasoning counts against every cap, so a reply can run out before
  a word is written. OV-307's one empty "@ project" reply was that: "how would my Dessert Recipes
  score against these reflexes?" was cut off at 1,000 tokens 3 times in 3, and at 2,000 once in 3,
  with 1,254 and 1,452 used when it got through. So an overview chat's cap is now 4,000
  (`MAX_ANSWER_TOKENS`). A reply that hits a cap fails as `AnswerCutOffError`, read from the
  provider's finish reason, rather than as unreadable JSON.
- **Pins** (OV-354): the routes also take `pins` and `setAside`. Pinned overviews, and a pinned
  project's 8 most recently added members, are read whole with that question beside the picks,
  never counted against the 5. One outside the project gets a label after the map's. They're stored
  as the question's `sources`, and setting one aside is a new message, as in an overview's chat.
- **`stats.read`** counts the overviews the answer read whole, and **`stats.looked`** how many the plan
  kept ("Looked across 112 of your 223 overviews · read 5 in full", OV-373). `looked` is absent when
  the overviews went whole. It's an optional field, so the chat schema doesn't move.
- **Not yet:** these chats don't read each other, and don't carry the reader's profile. The UI is
  the Ask page ("In the app", OV-354), and keyword minutes from transcripts are OV-352.

## Details from other transcripts

OV-352, step 3 of OV-307's recommendation. A detail only a transcript holds, such as an exact dose
or a named tool, needs transcript words, so each question is also searched by its words across
the account's other transcripts (`TranscriptPassagesRepository`, `keywordMinutes.ts`;
`transcript-storage.md`, "A search index of the minutes").

- **An overview's chat:**
  - The 8 best minutes go with the question, each with the minute either side. They are searched only
    in the overviews the question reads: pinned, found or already in the conversation, never the
    chat's own source or one set aside (OV-362).
  - Words alone never add an overview. Before OV-362 each overview a minute came from joined as
    found, past the cap of 3, and keyword scores don't tell relevant from not (an unrelated overview
    sharing one word scored 0.17, a relevant one 0.14), so a question could gather 11 overviews,
    most unrelated.
  - The minutes follow that question's sources as their own section (`[S2.p14 3:21] …`), and each
    question's are stored on its reader message (`minutes`), so later questions rebuild them in
    place.
  - The model cites one in `passages`, and code turns `S2.p14` into
    `{ overviewId, title, item: null, range }` (chat schema 5, client 27). It is never the source,
    so `inSource` stays about the chat's own transcript.
- **A project page's chat, past ~20k tokens:** the 8 best minutes of the members' transcripts
  follow the picked block (`O3.p14`). A point that rests on one is cited the same way. Whole-mode
  and library chats send none.
- **Search failing** never stops an answer: it goes on without minutes (`api.chat.keywordSearchFailed`).
- `api.chat.answered` counts `keywordMinutes` and `minuteCitations`. The app's pill reads
  "Title · 3:21" until OV-354's design round.

## Fitted to the reader

Each question carries what is known about the reader, as overview generation reads it
(`personalisation.md`, "Chat reads it too", OV-343), at the end of the system message so the
transcript stays the cached prefix. With nothing known, that block says so and points to Settings.
Fitting an answer to the reader is never a citation and never
makes an answer `inSource`.

## The server writes it

The answer comes from our server, so the server writes the record and devices get it down the
feed. `appendChatMessages` (`apps/api/src/chats/`) starts a conversation with its first
messages and appends the rest:

- **Only while the overview is there.** It reads the overview in the same transaction and
  refuses one that is missing or deleted.
- **Never onto a conversation the reader deleted.** A tombstoned chat is refused, not brought
  back.
- It is written at the server's own versions (`serverClientContext`), with the server's clock.

No route lets a device write a chat.

## Asking

`POST /api/chats/:overviewId/messages` with `{ conversationId, text, pins?, setAside? }`
(`ChatQuestionRequest`): a new conversation is a new uuid, a follow-up repeats its conversation's;
`pins` (`{ overviews, projects }`) and `setAside` are up to 20 ids each ("Other overviews" above). Signed in only, on
our key, on GPT-6 Luna (`chatModel.ts`) for every plan. `ChatAnswerer` settles everything that
can refuse before the answer starts, so a refusal is an ordinary JSON error:

| Refusal                                                    | Status                       | Details                                                                                            |
| ---------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------- |
| The overview isn't held, or the conversation was deleted   | 404 `not_found`              |                                                                                                    |
| A video or episode with no transcript kept                 | 422 `transcript_unavailable` | `chat: "no-source"`                                                                                |
| The conversation has `MAX_CHAT_QUESTIONS` questions        | 400 `invalid_request`        | `conversation: "full"`                                                                             |
| The month's, the day's or the global day's usage spent (or, `scope: "library"`, too little left for a library question) | 429 `too_many_requests`      | `quota`, `retryAfterSeconds`, `resetsOn` for the month (`tiers.md`, "Questions about an overview") |
| No key on this server                                      | 503 `unavailable`            |                                                                                                    |
| The provider failed before answering                       | 502 `generation_failed`      |                                                                                                    |

**Usage (OV-376, slice 1):** once an answer is stored, its real cost, both passes of a library
answer together, settles as usage on the day its question was reserved (`ChatUsageRepository.settle`),
and `chat.answered` logs `usageUnits`. A failed or stopped answer settles nothing. The limits
still count questions until slice 2 (`tiers.md`, "Chat usage").

**The answer streams** as server-sent events (`ChatStreamEvent`): a `sources` event first when the
question added other overviews, then `text` events carry the
answer as it arrives, then one `answered` event carries both messages as stored and the
record's rev, or one `failed` event says nothing was stored. The model replies in JSON,
`{ answer, passages, chatMessages, inSource }`, answer first, and `answerSoFar` reads the
answer's text out of the reply while the rest is still arriving. Since OV-319 the reply also
carries `overviewParts`, the ids of the overview's items it rests on.

**The prompt** is OV-267's `fullTranscript` shape, with the overview added (`chatPrompt.ts`):
the instructions, the overview with an id on each item an answer can cite, and the whole transcript in one-minute
passages with ids (`transcriptPassages.ts`), as the first message, which never changes, so
follow-ups and the overview's other conversations read it from the cache
(`prompt_cache_key` is per overview). Then the other conversations, then this conversation's
history, each question preceded by the other overviews it added, then the question.

**Citations are code's.** `citationsOf` turns passage ids into `{ startMs, endMs }`, the
overview's item ids into `{ part, index, textHash }` and other chats' message ids into
`{ chatId, message }`, drops any id the model wasn't given, and sets `inSource` only when the
answer cites the transcript.

**A provider refusing for now** (429 or 5xx) is asked again after its `retry-after`, at most 5
seconds, or after 1 then 3 seconds, before anything streams. A third refusal, any other
failure, or a reply that can't be read gives the message back and stores nothing; the tokens
the provider billed still go into the cost tally, as `message-failed`.

**Stopped or abandoned.** When the reader stops an answer, or the connection goes, before
the answer is stored, the server stops asking the provider, stores nothing and gives the
question back (`api.chat.stopped`). The provider reports tokens only at the end, so what it
billed for the part already written isn't priced.

**Costs and logs.** Each answer's tokens and list-price cost go into `account_costs`, area
`chat` (`unit-economics.md`). `api.chat.answered` logs the plan, model, tokens, cached share,
cost, `inSource`, the citations of the source, of other chats and of other overviews, how many
other chats' messages went in, whether search ran, how many other overviews the question added
(pinned, found, brief) or set aside, the month's count and the time; never the question or the
answer. A reply with no answer fails as `EmptyAnswerError`.

**Always on us.** Every plan asks on our key, whatever key it makes overviews with, and
"Only ever use my key" doesn't change that (owner, 16 Nov 2026). Settings › API keys says so
under that switch: the reader's key is only used to make overviews
(`OWN_KEY_FOR_OVERVIEWS_ONLY`).

Every kind of chat (an overview, a project, the library) takes one message of the allowance per question, however many passes the answer takes; the message is reserved before anything is asked.

## Measured through the endpoint

`apps/api/src/scripts/chatHarnessCheck.ts` runs the real endpoint in process, on an in-memory
Postgres, against OpenAI on our key, and reads its own log line for tokens and cost. Run on 16
Nov 2026 with `modelPrices.ts` as checked on 9 Nov (Luna $0.10 in, $0.01 cached, $0.50 out per
million). The overview in the prompt was a fixture, since the spike kept only the notes' text.
Latency wasn't measured: the in-process clock doesn't move.

**OV-267's question set** (6 sources of 10 to 89 minutes, 6 questions each, one conversation
per source, twice): answered or declined rightly 72 of 72, declined all 24 the source doesn't
cover, cited the right moment 46 of 48 (10 of 12 for questions needing two moments far apart),
named the expected detail 48 of 48. That matches OV-267's `fullTranscript` arm. A message cost
$0.00021 at the median, with 99% of its prompt read from the cache; the first of a conversation
cost up to $0.0022.

**The worst case:** the library has nothing over 89 minutes, so the two longest were joined end
to end into a 169-minute source of about 33,000 tokens. Two 30-question conversations on it,
the second carrying the first (all 60 of its messages fitted the budget):

|                             | First question | Each later question (median) | 30 questions | Prompt tokens, first to last |
| --------------------------- | -------------- | ---------------------------- | ------------ | ---------------------------- |
| Alone                       | $0.0042        | $0.00042                     | $0.016       | 32,800 to 35,100             |
| With the other conversation | $0.0045        | $0.00046                     | $0.018       | 35,200 to 37,500             |

So 30 questions of history and a full other conversation add about 10%. The cap was raised
to 50 on 16 Nov 2026, after this run, because a reader deep in a conversation shouldn't be cut
off; 50 questions has not been measured. The extra history is read from the cache like the rest.

**A new conversation reads the transcript from the cache (OV-313).** In that run the second
conversation's first question paid to cache the whole prompt again, at 1.25× input, although
the transcript was the same. A probe of five calls on one transcript (`chatCacheProbe.ts`)
found why: the other conversations went as a second `system` message, which OpenAI folds into
the first, so the transcript was no longer the prefix it had cached. A different question
after the transcript, the other chats inside the question, or the other chats as a `user`
message each read all of it (16,922 of 16,933 tokens). They now go as a `user` message. Checked
again through the endpoint on the 169-minute source: the second conversation's first question
cost $0.00041, reading 99% of its prompt from the cache, where it had cost $0.0045.

What still costs is the first question about an overview whose transcript hasn't been asked
about in the last 30 minutes, the cache's lifetime on Chat Completions (`spend.md`): about $0.004
on a source that long, $0.002 at 89 minutes. Every later question, in any conversation about it,
is about a tenth of that.

Run from `apps/api` after a build: `node --env-file=../../.env dist/scripts/chatHarnessCheck.js <OV-267 chat data dir> <out.json> [long-only <questions> | profile | product]`. With no mode it runs OV-267's question set and a worst case of 30-question conversations on a source over two hours with another conversation sent. `long-only` skips the question set and asks each long conversation only its first few questions, enough to see whether a second conversation reads the transcript from the cache. `profile` (OV-343) asks every source's questions twice, with nothing known about the reader and with the harness's `READER` profile, plus two questions about the reader; code scores the source rules and the "what do you know" one. `product` (OV-342) asks every source the `PRODUCT` questions: ones a general assistant would answer by offering a photo, a link or the web, one about the rest of the library, and one about where onboarding's answers go, scored by `productRight`. A source with no `transcript.json` is a web page, answered from its overview alone, and every answer is checked for numbers the overview does not hold; the long-source part needs two sources with transcripts.

`chatCacheProbe.ts` is run from `apps/api` after a build as `node dist/scripts/chatCacheProbe.js <a sources/<id> dir with transcript.json>`: each probe follows the first within seconds on one `prompt_cache_key` and reports what OpenAI says it read and wrote.

## Citing the overview

OV-319. An answer can rest on the overview's own items, not only on the transcript: "Why is
this marked dubious?" is answered by the overview's reason, "What should I do first?" by its
first step, and "How do I apply this?" by How to apply, which may go beyond the source on
purpose.

**The items, and their ids.** `overviewParts` lists the items an answer can cite, in the
note's order, and `overviewMarkdown(overview, { partIds: true })` writes each with its id in
the prompt: the verdict (`verdict`), why it is dubious (`dubious1`), key points (`kp1`), the
steps it gives (`step1`), How to apply (`apply1`), what it sells (`sells`), Watch it anyway
(`anyway`), chapters (`ch1`), and a recipe's ingredients (`ing1`) and method (`method1`). The
premise, big picture and core claim have none: they are cited from the transcript. A test
holds the ids in the prompt to exactly the parts `citationsOf` accepts. An article's chapters
are `chapter` parts and its Read it anyway? is `watchAnyway`, so chat on articles (OV-320)
needed no new kind of citation and no schema change.

**What the prompt asks.** Cite the item an answer rests on, and the transcript as well where
it backs the same point. The verdict, the dubious reasons, what it sells and Watch it anyway
are the overview's judgement, not the source's words, so a question about them is answered
from the item, citing the moment it refers to where there is one. An answer never speaks of the
overview as a third party ("the overview suggests") or in the first person: it gives the answer
and marks a line only against the source, naming the section when the question is about one
("Watch it anyway says…"). An answer from How to apply adds that it goes beyond the source when
it does (design 319k). `inSource` stays about the transcript alone.

**A regenerated overview** keeps its id, its chats and their citations, but its items can move
or change. A citation keeps the item's place and a hash of its text (`overviewPartHash`,
FNV-1a, so the server and every client compute it alike without an async digest).
`citedOverviewPart` follows the text to wherever it moved within its part, falls back to the
part's section when no item still holds it, and to nothing when the section is gone.

**Over MCP**, `get_chat` writes an overview citation as `item 2 of the overview's "The steps
it gives"`, or as the section and "an item since changed", and an answer from the overview alone as "Answered from
the overview, not from what the video says".

**Clients before it.** The new citation moved the `chat` schema to version 2, at client
version 24 (23 was OV-318's project filing, released first, so a client at 23 reads
project members at 2 and chats at 1). A chat written since is held back by an older client, which counts it towards the
stale-client banner, rather than failing to parse (`record-migrations.md`). Nothing new goes to
the model: the overview already did.

**Logs and analytics.** `api.chat.answered` and `reader.chat.answered` count overview
citations (`overviewCitations`) beside those of the source and of other chats.

**Ids out of the answer's text.** The model sometimes writes the ids it cites into the answer
too: "[p28–p30]", "(p24)", "[kp4] [apply1]". It did before OV-319, in production. Citations
carry them already, so `withoutCitationMarks` drops every bracketed run of passage, overview
and chat-message ids from the text, whatever separates them ("(p3; step1)"), both as it
streams and as it is stored. A bracket left holding only separators, "(;)", goes too (OV-344:
an answer ended with one in OV-343's harness run). While the reply
arrives it holds back a half-written mark and the space before it, so the streamed text only
ever grows. Brackets that are prose, "(perhaps 3g)", stay.

**Measured through the endpoint.** `chatHarnessCheck.ts` now puts each source's real overview
in the prompt (read back from its saved Markdown by `overviewFromMarkdown`), and
`overview-questions.json` adds 17 questions answered from the overview's own items: steps,
How to apply, why it's dubious, Watch it anyway and the verdict, each scored by code on whether
the answer cites one of the parts it lists. Run on 17 Nov 2026, the same six sources twice
and the 170-minute worst case:

- **Cited the right part 33 of 34.** The miss gave the right step without citing anything; the
  same question cited it on the other run. Named the expected detail 32 of 34: both misses are
  one question about a conflict of interest, answered from the right reason in other words.
- **OV-267's questions held up** with the overview's items in the prompt: answered or declined
  rightly 71 of 72, cited the right moment 47 of 48, named the expected detail 48 of 48. The
  one wrong flag was a decline that also cited How to apply and set `inSource`. 8 of the 72
  cited an item as well as the transcript.
- **On the long source** every overview question cited its part (6 of 6), and the source flag
  was right 24 of 24.
- **Wording:** no answer said "the overview suggests" or spoke in the first person. Two echoed
  Watch it anyway's own reason, "the overview and transcript carry the substance".
- **Cost:** a message cost $0.00024 at the median, 99% of its prompt from the cache. On the long
  source the first question cost $0.0044 and each later one $0.00044, about what it cost
  without the overview's ids (above).
- **Ids in the text:** 67 of 166 answers had written ids into their text, passage ids mostly.
  `withoutCitationMarks` removes all of them and nothing else.

## No transcript, no chat

The server answers only from what the account holds itself (`transcript-storage.md`). A video
or episode without a stored transcript is refused with `chat: "no-source"`. The panel hides
itself on that refusal (degrade visibly). An article or a recipe page is never refused this
way: it is answered from its overview alone (below).

## Articles and recipe pages

OV-320. The server keeps no text from a web page (OV-295), so `{ paragraph }` citations still
wait, but the overview is kept, and for many questions it is enough: an article's key points,
its chapters and Read it anyway?, a recipe page's ingredients and method.

- **What a chat is about.** `chatSourceKind` says `video`, `episode`, `article` or `recipe`
  (a web overview with a recipe). `answeredFromOverviewAlone` is true for the last two.
- **The prompt** for them (`overviewOnlyPrompt` in `chatPrompt.ts`) has the overview and no
  transcript. It asks the answer to cite the items it rests on, never to set `inSource`, to
  name the section rather than speak of the overview, and to say plainly when "the overview of
  this article doesn't cover it" or "the recipe doesn't cover it". A fair question about the
  subject then gets general knowledge too; one about what the full page says doesn't, since only
  the page could answer it ("Beyond the source" below).
- **Amounts stay code's job** (`docs/prototype/constraints.md`). Wherever the overview holds a
  recipe, a page's or a video's, the prompt forbids scaling a quantity, changing the servings
  or converting a unit or temperature, and points to the servings control above the
  ingredients, which scales them in code (OV-231).
- **`inSource` is always false** for them: `citationsOf` only counts transcript passages. An
  answer that cites the overview is `answeredFromOverview`; one that cites nothing is a decline,
  or general knowledge.
- **Logs and analytics:** `api.chat.answered` and `api.chat.failed` carry `about`, and so do
  `reader.chat.answered` and `reader.chat.waited`.
- **Over MCP**, `get_chat` says an article's answers come from its overview, not the page, and
  notes only a decline; a cited Read it anyway? is named as such.
- **Measured through the endpoint** on 17 Nov 2026 (`chatHarnessCheck.ts`, which takes a source
  with no `transcript.json` as a web page, read back from its saved Markdown): three articles
  (Paul Graham, The Pragmatic Engineer, The Age) and three recipe pages (RecipeTin Eats, Good
  Food, BBC Food) from the library, 38 questions asked twice.
  - **Cited the right part 56 of 56**, and named the expected detail 56 of 56: steps, How to
    apply, Read it anyway, the verdict, what it sells, chapters, ingredients and method steps.
  - **Declined with nothing cited 16 of 20.** The other four said plainly that the detail wasn't
    there and cited the item that comes nearest: the method step that says "frosting of
    choice", and Read it anyway, which says the full quote is left out. They show a pill, not
    the "Not from" label.
  - **No amount worked out by the model.** Every answer is checked in code for numbers neither
    the overview nor the question holds, and none had one. "Make 24 instead of 12", "halve it"
    and "feed 8" each gave the recipe's own amount and pointed to the servings control.
  - **Wording:** 4 of 76 answers spoke of "the overview", two of them while declining.
  - **Cost:** about 1,900 prompt tokens, so a message cost $0.00009 at the median and $0.0003
    at most, 97% read from the cache.

## Beyond the source

OV-329, from the first real chat data: 8 of 17 answers between 16 and 18 Nov 2026 were not
`inSource`, and the questions behind them were mostly fair ones the model could answer ("why
remove the chorizo skin?", "can I combine scalp massage with derma rolling?"), declined only
because the prompt forbade general knowledge.

- **The prompt** (`beyondSourceRules` in `chatPrompt.ts`, for every kind): a fair question about
  the source's subject that neither the transcript nor the overview answers begins "The video
  doesn't cover it." and then answers briefly from general knowledge. An answer the source
  covers in part gives the source's part first, with its citations, then "Beyond the video, …".
  It says how settled the knowledge is, and on health, medicine or safety keeps to what is well
  established. A question about where or whether the source says something, or one off its
  subject, is still declined with nothing added.
- **The label is code's**, from the citations, as before: an answer that is not `inSource` and
  cites no part of the overview says "Not from the video" (episode, recipe, "the overview of this
  article"), whether it declines or adds general knowledge. No new field on the record, so no
  schema bump. A mixed answer is `inSource`, and its wording marks the part beyond the source.
- **`generalKnowledge`** in the model's reply tells a general answer from a decline, and goes
  only into `api.chat.answered`, so how often readers go beyond the source can be read (the
  signal for OV-315's web check). It is never stored or shown.
- **Over MCP**, `get_chat` says a source doesn't cover a question and that anything the answer
  adds is general knowledge, not from the source.
- **Measured through the endpoint** on 18 Nov 2026 (`chatHarnessCheck.ts`, Luna on the evals
  key): two videos (Vox on creatine, Hairguard on scalp massage) and a recipe page (chorizo
  soup) from the owner's library, with the owner's real questions, each set twice, then a
  30-question conversation over both videos joined, twice. 86 messages, none failed, $0.019 in
  all, median $0.00018 a message.
  - **Off-subject or "where does it say" questions** (chickens, wine, storing creatine,
    the capital of Peru): declined with nothing added, 14 of 14.
  - **Fair questions the source doesn't answer** (is creatine vegan, creatine with coffee,
    derma rolling with massage, why remove the chorizo skin, why transplanted follicles resist
    baldness): a general answer every time, hedged where the evidence is mixed, and "ask a
    dermatologist" on derma rolling. Six of the 18 were mixed: the source's related part first,
    cited, then "Beyond the video, …", so they are `inSource` (or cite the recipe's method
    step) and the harness's `rightOnSource` counts them as misses. The transplanted-follicles
    question rests on the overview's "Why it's dubious" item each time, which is right: the
    overview says it, the video doesn't.
  - **Questions the source answers** kept their citations: right moment 12 of 12, right part
    of the overview 2 of 2, never `generalKnowledge`.
  - One answer began "The overview notes", the wording slip OV-319 measured at 4 of 76.
- **Not yet:** how such an answer looks (Claude Design, with OV-315's button). Until then it
  keeps the decline's muted label, reworded.

## Knowing the product

OV-342, from the owner's chats on 19 Nov 2026: asked to check a cereal's nutrition, chat offered
to read a photo of the label, and asked whether an episode connected to the rest of the library,
it doubted that the overview's similar overviews were in the reader's library at all. The prompt
said what to answer from but nothing about the app it sits in, so the model filled the gaps as a
general assistant would.

- **The prompt** (`productBlock` in `chatPrompt.ts`, every kind) has a short `# The Overview`
  section before the overview. Chat has only the reader's typed messages, the overview, the
  transcript where there is one, and the other conversations it is shown; it can't see images
  or files, open links, search the web, read the rest of the library or act outside the chat,
  never offers to, and says what the reader can do instead (type a label's figures in). The
  overview's similar overviews are the reader's own saved overviews, and How to apply is fitted
  to them. What The Overview knows about the reader comes from About you, asked in onboarding and
  in Settings › Personalisation, and from what it notices in their overviews; they change it, and
  which sections an overview has, in Settings › Personalisation. A recipe, a page's or a video's,
  has no verdict, so those two lines are left out.
- **"Settings › Personalisation" is a link.** The prompt has chat name the place in those exact
  words, and `ChatAnswer` turns every one in an answer into a link to that section, in code, so
  the model never writes a link and a reader taps straight through.
- **The Markdown says it too.** `overviewMarkdown` writes the verdict's `similarTo` as "Similar
  overviews in the reader's library:" (was "Similar to:"), which every reader of the Markdown
  gets: chat, `get_overview` over MCP, and the hand-off and follow-up prompts.
- **Measured through the endpoint** on 19 Nov 2026 (`chatHarnessCheck.ts <dir> <out> product`,
  Luna on the evals key, OV-267's six library videos, each twice; 48 messages, none failed,
  $0.028). Code scores each answer (`productRight`):
  - **"Can you check the label on the packet I've got at home?"** and **"I found another article
    that disagrees with this. Can you compare them?"**: no offer of a photo, upload, link or web
    search, 24 of 24. Every answer asked for the figures or the text to be typed or pasted in.
  - **"Is this connected to anything else in my library?"**: the three videos with similar
    overviews named them as "in your library", 6 of 6; the three without said chat can't see
    the rest of the library, and claimed none, 6 of 6.
  - **"Is what I told you during onboarding used here?"**: pointed to Settings › Personalisation,
    12 of 12.
  - **No regression** on OV-267's question set and the long conversations, run beside main's
    prompt on the same data (132 messages each, $0.065 each): right moment 47/48 (main 46/48),
    long 16/16 (15/16), right on the source 71/72 (71/72), no "the overview" wording either way.
    On the long conversation one notInSource question cited the passage beside the point it
    declined, twice, so it counted as `inSource`: the same decline as main's, worded the same.
    The 12 of 24 notInSource questions answered from general knowledge were 12 of 24 on main too:
    the declined ones ask for current facts or what someone thinks.
- **Not yet:** the rest of the library (OV-307). Until then a question about it is answered from
  the similar overviews' titles alone.

## Deleting

- **One conversation:** `DELETE /api/chat-records/:id` tombstones it, whatever owns it (client 26
  on). Clients up to 25 use `DELETE /api/chats/:overviewId/:conversationId`, which stays. A retry
  of one already deleted answers 204. On a device, `ChatStore.deleteChat` removes it and journals
  the delete, which the outbox pushes like any other.
- **With its overview:** deleting an overview tombstones its chats, in a sweep run after the
  overview's own tombstone commits and on every retry of the delete (`tombstoneChats`, through
  `tombstoneLiveRecords`, which the membership sweep uses too). A chat written before the
  overview went is caught, and none can be written after, because the write refuses a
  deleted overview. This follows projects' membership records rather than sharing the
  overview's transaction, which would need the ids before the transaction opens. A device
  removes the overview's chats when it deletes the overview, or when it pulls the overview's
  tombstone, without journaling them, since the server's delete takes them.
- **With its project:** deleting a project tombstones the chats on its page in the same way
  (`tombstoneChats({ kind: "project" })`, after the membership sweep). A device drops them when it
  deletes the project or pulls its tombstone (the `byProject` index, local database version 8).
- **A library chat** has no owner to go with: it goes when the reader deletes it, or with the
  account.
- **With the account:** chats are rows in `records`, which go with the account
  (`account-deletion.md`). `accountDeletion.test.ts` seeds one.

## On the device

`IndexedDbChatStore` reads the `chats` object store (database version 7), indexed by overview:
`listChats(overviewId)` oldest first, `getChat(id)`, and `deleteChat(id)`. Nothing shows them
yet; OV-310 builds the panel.

## In the app

OV-310's plumbing, ahead of the panel the Design round draws:

- **`ChatApi`** in `@overview/sync` (`createFetchChatApi`): `ask` posts the question and reads
  the server-sent events, handing each piece of text to a callback and settling as `answered`
  or `failed`; a refusal before the answer starts throws the API's own error. `usage` reads
  `/api/chat-usage`.
- **`chatStore`** joins `Stores`, so the panel reads an overview's conversations from the
  device (`useChatsQuery`), and a sync pull refreshes them. `useDeleteChatMutation` takes one
  out of the list at once and journals the delete.
- **`useAskQuestion`** asks and follows the answer: `answering` with the text so far, then the
  stored exchange goes straight into the conversation (`withAnswer`) and sync brings the record
  down behind it; `failed`; or `waiting`, with the wait `chatWaitOf` read from the refusal (the
  month with its reset date, the day, everyone's day, a full conversation, or nothing to answer
  from, which hides the panel). Stop aborts it, and the server gives the question back.
- **`chatOffered`** hides chat signed out, on someone else's shared overview, and on an
  overview the server doesn't hold yet
  (`useOverviewSyncedQuery`, as "Open in web app" does). The server answers from its own copy,
  so one still on the device alone, like onboarding's overview kept back by a spent month
  (`tiers.md`, "Counting"), could only be refused "No such overview". Chat shows once the
  overview syncs (OV-321).
- **Where a tapped question goes:** `Settings.questionsAnsweredHere`, answered here by default
  (`follow-up-questions.md`, "Answered here").
- **Another overview cited** (OV-355) is a chip under the answer, `ChatOtherOverviewCitation`: the
  title it had when cited and, for an item or a minute, its place ("· Key point 2", "· 3:21"),
  opening that overview. Once the overview is gone from the library it reads "an overview you
  deleted" and isn't a link. Since OV-354 it is the shared chip ("Inside an overview's chat").
- **Events**, `reader.chat.*`: opened (from a question, typed, or the menu), closed, asked (from
  a question or typed, new conversation or not), answered (in the source, citations of each
  kind), answerFailed, stopped, waited (which wait), citationFollowed (to what, another overview
  included; for an overview, the part and, unless it changed since, the item's place, never its
  text), answerCopied, continuedIn
  (assistant, filled in or copied, connected), conversationOpened and conversationDeleted. Since
  OV-354: asked also carries how many overviews and projects it newly pinned and set aside, and
  whether Search my library was on; sourcesAdded (how many pinned and found, from the stream's
  `sources`), sourcePinned (overview or project), sourceRemoved (one, or all), searchLibrarySwitched
  and sourcesMenuOpened (how many sources). Never the question, the answer or a title.

### Beside the note (design 310a, 310d–310p)

On the web, chat is a column on the right (`ChatPanel`, `useChatPanel`): the note's column eases
left as it opens (320ms, `.layout` in `ReaderPage.module.scss`), and the chat sits under the bar,
sticky and fixed in height, 400px wide (360px under 1280px), so the note scrolls on its own beside
it. Its field takes focus as it opens; Esc stops an answer being written, or else closes the chat
and returns focus to what opened it. On a phone and in the extension's panel it is a sheet instead
(`ChatSheet`, design 310g, 310h, 310o). Beside the note the panel is on `--card`, the sheet's colour, with
what is raised in it on `--surface` and, in light, a soft shadow (`--shadow-chat`; design 324al, 324am).

- **Motion and focus beside the note** (design 310a-4–310a-6, 310aq): a question tapped under the
  note, or typed in its field, travels into the chat as its question, 520ms ease-out, following
  the chat as it slides in (`bubbleTravel`); none with reduced motion. Closing plays the opening
  backwards. F6 moves between the note and the chat, which isn't modal. A question answered here
  shows "Answered here · just now" under its bubble, read from the synced conversations, and that
  opens its conversation (`useChatPanel.answeredHere`).
- **The sheet:** 64px from the top on a phone, under the masthead in the panel. Raised it is a
  modal dialog holding focus, over a scrim. Its handle (a button, "Lower chat" / "Raise chat") or
  its header drags it, following the finger with resistance past either rest (`sheetDrag`); let
  go, it springs (420ms) to the nearer rest, or where it was flicked faster than 0.5px/ms.
  Lowered, it shows only the conversation's title and a line, and the read-aloud bar moves up
  above it. A citation that plays (the video beside the panel, an episode's audio) lowers it to
  "Playing 3:28–4:23 from the answer"; reading a cited stretch in the transcript lowers it to say
  so; "Back to the conversation" raises it.
- **Ways in:** a question under the note (answered here, `follow-up-questions.md`), the note's own
  field "Ask about this video" (`NoteAskField`, which fades out while chat is open), and Chat in the
  overview's menu. With chat closed, a question starts a new conversation; with it open, it asks
  in the open one; the menu reopens the most recent, or a new one.
- **A conversation:** the reader's question in OV-266's bubble, then three dots until the answer's
  first whole word, then the answer, each word fading in as it arrives, with Stop in Send's place
  (OV-341). It streams in the final answer's paragraphs, holding back a word until it is whole, so
  nothing moves when it lands; then its label, pills and Copy fade in. Reduced motion shows the
  words without fading. A label "Not from the …" marks an answer the source didn't cover; its
  text is as plain as any other, since the grey it once had read as disabled. Stopping keeps what was
  written, says "Stopped. This one didn't count." and stores nothing. A failure says so, with Try
  again. The answer is announced once, when final ("Answer: … 1 moment cited.", or "Not from the
  video: …").
- **Citations:** each stretch of the source is a pill under the answer, from the record's times,
  named "Play the video, 3:28 to 4:23". Following one tints the key point holding it
  (`citedLineIndex`) and, where a player can seek (the video beside the extension's panel, an
  episode's own audio), plays from there; on the web, which has no player for the video, it offers
  the video at that time on YouTube or the transcript, as a note's moment does.
- **The overview cited** (OV-319, design 319a–319ac; handoff `design_handoff_ov319_citing/`): each
  part of the overview an answer rests on is an outlined pill with the note's mark
  (`ChatOverviewCitation`), named by the note's own heading: Step 2, Key point 3, How to apply,
  Verdict, What it's selling, Watch it anyway?, "Chapter: Dosing", "Ingredient: …", Method step 4,
  and "Why it's dubious" for a dubious reason. A section the note doesn't number is numbered only
  when one answer cites two of its items ("How to apply, 1"). Its accessible name adds the item's
  opening words. They come first in the answer's one row of pills, in the note's order, then the
  video's in time order (`overviewCitationViews`). An answer from the overview alone has no label:
  "Not from the video" is only for one that cites neither. Following one keeps chat open, switches
  to Chapters for a chapter, opens folded steps or the dubious reasons when it has to, brings the
  part to about 90px below the top, tints it and gives it focus (`CitedOverviewPartContext`, the
  global `[data-cited-part]` rule); the verdict, What it's selling and Watch it anyway are tinted
  whole. A polite status says "Showing Step 2 in the overview. Escape returns to the answer." and
  Escape does, a second closing chat. On a phone and in the panel the sheet lowers to "Showing
  Step 2 from the answer", and raising it returns focus to the pill. One tint at a time, until
  another citation is followed or chat closes. An item rewritten since reads "Step 2 · since
  changed" and leads to its section's heading; a section no longer in the overview is muted text,
  "What it's selling · no longer in the overview", not a link.
- **Copy under each answer** (OV-324, design 324x, 324ae, 324af): the latest answer's always shows;
  an earlier one's on hover, focus or tap, in a slot kept so nothing moves (`ChatAnswerActions`).
- **The header** is the title, New conversation, ⋯ and Close (OV-324, design 324x–324ag). ⋯
  (`ChatConversationMenu`) is a menu under the header on the web and an action sheet on a phone and
  in the panel. It holds Conversations, with the count, when there are others about this overview,
  and, once there is a final answer, "Continue in {assistant}" (`chatHandOffPrompt`): connected, it
  names the overview and the conversation for the assistant to read with `get_chat`; otherwise it
  carries the note and the conversation, filled in or copied. Its second line says which, or "Sends
  the finished answers" while a later answer is written. With no assistant chosen it reads
  "Continue in…" and opens OV-266's menu as "Continue in" in its place. Since OV-354 ⋯ also holds
  Search my library, so it always shows in a conversation. After a hand-off, focus returns to ⋯ and
  the toast above the field says what happened.
- **An overview's conversations** (design 310q–310u) sit behind the header's ⋯, and the note's
  "3 conversations about this video" opens them: newest first, the open one tinted, New
  conversation at the top. A new conversation is nothing until its first question. Deleting is at
  once, with Undo in a toast for six seconds; the delete is made when the toast goes, or at once if
  the reader leaves the overview first (`useChatPanel`).
- **Another conversation cited** (design 310w–310y): a link with a speech mark, "From your
  conversation · 12 Nov" over its first question, before the answer's pills, since a pill plays
  and a link opens words. Following it opens that conversation at the cited message, outlined for
  a moment with focus on it, and the header says when it was and how many questions it holds; a
  link at the top goes back to the citation. One since deleted reads "From a conversation you
  deleted", muted, not a link. That a new conversation can see the others is said once, in its
  empty state, and otherwise only by these citations.
- **The meter and the waits** (OV-376, designs 376a–376i; 310ae–310ai before it): chat is counted
  in usage (`tiers.md`, "Chat usage"), so readers see a share, never a count. Under half used
  nothing shows under the field. From half, `ChatMeterLine` adds one quiet line under it, a 44 ×
  4px bar and "60% of chat used · Resets 1 December", rounded down to tens (`chatMeterOf`). From
  90% it takes the alert colour in whole percent, at most 100, with See plans or See Plus where a
  plan gives more, and is announced once; the bar is hidden from assistive tech. Settings › Plan
  always shows the full meter ("Chat, on us", "% used", an 8px bar, and "Questions about one
  overview use the least; questions across your library use more.", or "Nearly used up" from
  90%). A wait takes the field's place (`ChatWaitBlock`, copy in `chatWaitCopy`), with the
  questions above it hidden: "You’ve used this month’s chat" says when it's back, that overviews
  keep working, and offers only plans that give more (Free: See plans; BYO Plus: See Plus; Plus:
  nothing); the day's limit and everyone's day say tomorrow in usage words and offer nothing. A
  month already spent shows its wait as chat opens, from `/api/chat-usage` (`spentWaitOf`).
  `reader.chat.meterShown` and `ask.chat.meterShown` report each state once, by plan. At 50 questions a conversation offers New
  conversation in the field's place, and its header adds "· 50 questions". Offline, the field
  gives way to "You're offline"; past conversations stay readable. No words four seconds after
  asking says "Still working on it…"; words stopping for six say the connection is slow
  (`useSlowAnswer`). Each plan's allowance lives in `chatAllowances` in `@overview/domain`, which
  the server and the app both read.
- **Questions to ask next** sit above the field in an empty conversation: the set of three, with
  Different questions (`chatSuggestions`). They go once the first question is sent, as it is
  being answered and for the rest of that conversation (OV-323), and while the reader types.

### Inside an overview's chat (OV-354, pages 1, 2 and 5)

From the hand-off's pages, built for the panel beside the note and the phone sheet:

- **The "@" picker** (`ChatComposer`) opens from the "@" at the field's left or by typing "@" at the
  start of a word (`atQueryOf`). The field is its combobox: arrow keys move, Enter pins, Escape
  closes, and a polite line announces how many projects and overviews it shows. Empty, it lists the
  projects with their counts, then the four overviews saved most recently; typed words filter titles
  and project names, every word matching and shown in bold, the first eight with "N more · Keep
  typing to narrow it down." (`sourcePickerOptions`). Titles only, no search by meaning. Never the
  chat's own overview, nor anything already added. At 20 it says so and pins nothing more.
- **The row above the field** is everything the next question sends besides its words: what was just
  pinned, then what the conversation already added, pinned or found (`conversationSources`, from
  each reader message's `sources` less its `setAside`). One row that never wraps: two quiet chips,
  then "+N", whose menu removes any of them or clears them all. A chip's × ("Remove source · Not
  used for your next question") keeps focus in the field; removing a pin just unpins it, removing a
  conversation's source sends it as `setAside` with the next question. Pinning it again brings it
  back. One deleted since is muted.
- **What a question drew on**: "Pinned" above the question, right-aligned, and "Found for you" below
  it, left-aligned, both from the stream's `sources` while it is answered and from the stored
  message after (`ChatDrewOn`). Their chips open the overview and have no ×: a sent question keeps
  its sources. Nothing found means no row, never an empty one.
- **Search my library** is a switch in ⋯ (so ⋯ always shows in a conversation): "On: up to 3 close
  overviews are read with each question", "Off: only what you pin with "@" is read". It goes as
  `searchLibrary` with each question, and a conversation reads its last question's
  `searchedLibrary`, so the choice is the conversation's on every device; a new one starts on.
- **One chip for every reference** (`ChatSourceChip`): 28px, a 1.5px outline, a mini thumbnail when
  the overview has one, the title cut with an ellipsis, then its place ("· Key point 6", "· 3:21")
  and "+n". The note's own parts (`ChatOverviewCitation`) and other overviews use it; the video's
  time pills keep their fill at the same height. The row above the field uses its quiet form.
- **Long chip rows fold** (OV-362, `ChatChipRow`): two chips, then "+N", whose menu lists every
  one. "+N" is named by every title it hides. This holds for a section's sources by relation, a
  list item's own chips, Pinned and Found for you.
- **Markdown in answers** (OV-362, OV-364). The prompt allows light Markdown in the text: bold for
  a few key words, italics, inline code, fenced code blocks with their language, and links only to
  an address a source gives. It allows no headings, tables or HTML. Every chat draws it the same way
  (`ChatAnswerText`, `ChatMarkedText`, `inlineMarks`, `answerBlocks`):
  - Bold, italics and inline code render as such.
  - A link opens in a new tab, and says so to a screen reader. Only http(s) addresses become links;
    for any other, the words stay and the address goes.
  - A fenced block is a monospace block on the surface tint, naming its language, with Copy. It
    scrolls sideways and can be reached by keyboard. That includes a block inside a section's
    numbered or bulleted item: an item holding a fence is drawn as paragraphs and blocks, and any
    other item stays inline (OV-372).
  - Raw HTML stays text.
  - While an answer streams, an open mark or fence shows as it will be, never its markers.
    A half-written link shows its words alone.
  - The server's clean-up (citation marks, dashes, double spaces) never touches code
    (`outsideCode`), so indentation and brackets survive.
  - Copy answer copies the Markdown source.
- **Following another overview's citation** (OV-362): its link carries the cited item
  (`citedPlace`), and the reader page opens at that item, tinted and scrolled to, switching to
  Chapters for a chapter. An item rewritten since lands on its section. The state is cleared, so a
  reload doesn't repeat it.
- **The field**: the "@" is as tall as Send, so it lines up with the text. A long placeholder ends
  in an ellipsis. The picker scrolls past 22rem, and opens below the field when there's no room
  above, as in the Ask page's empty state.
- **Answers in sections** (`ChatAnswerSectionsView`): the intro, then each section's heading,
  paragraphs, numbered and bulleted lists, and its sources grouped by relation ("Supports"), then
  "Takeaway". The intro streams; each section shows as it lands, its sources once the answer
  settles. A sectioned answer has no citation row under it: "Sources N" beside Copy opens every
  source it cites, the overview's own first, N counted by code.

### The Ask page (OV-354, pages 3 and 4)

Library and project chat in the app. `Routes.ask()` is `/ask`, with `?project=` for a project and
`?chat=` for the open conversation, so a reload keeps it (`AskPage`, `useAskPage`):

- **Ways in:**
  - The Ask pill in the top bar is the same pill as + New, with a square speech-bubble icon, ringed
    while the Ask page is open (owner, 22 Nov 2026). It's a link, so it holds off the global link
    hover colour, and its text stays on the action colour as + New's does.
  - On a phone (47.9375rem and below), Ask and + New are 44px round icons, each named by a tooltip
    on hover and keyboard focus ("Ask your library", "New overview") (OV-362). On touch the tip
    shows only while the icon is pressed and held, and that press doesn't follow it; a tap opens
    the page with no tip left showing (frontend-architecture-guide.md §4.4).
  - A project's page has an Ask link beside Copy as Markdown, which opens the page over that
    project.
  - Both show only signed in. Neither is in the extension's panel, which keeps chat within an
    overview.
- **No header and no close:** the top bar is the way back, and on a phone it's a page, not a sheet.
  Signed out it says to sign in.
- **Empty** (354u), the field sits centred under "Ask across everything you've saved." or "Ask about
  this project." (Gloock, 30px), with the project as a surface pill above it.
  - The field is the large one, at least 56px.
  - Its placeholder is "Ask your library or @ to add sources" ("Ask about this project or @ to add
    sources"), or "Ask or @ to add sources" on a phone. It stays on one line.
  - Under it are three starter questions as cards on the tile surface with a corner arrow. They're
    made by code from templates, never by a model (`askStarters`):
    - **For the library:** its biggest topic with three or more overviews, its biggest unarchived
      project with three or more, and how many are unread.
    - **For a project:** what it's for, where its overviews disagree, and how many are unread in it.
    - Plain questions fill any that don't apply.
- **Asking** (`useAskOver`, `ChatApi.askOver`) posts to the library's or the project's route with
  `pins` and `setAside`; the "@" picker and the row above the field are the overview chat's
  (`ChatComposer`, with nothing excluded). Pinned shows above the question.
- **Scrolling** (OV-362): a question just sent, or a conversation just opened, scrolls its question
  to the top once. The answer then reads down from it and is never followed to its end. The
  overview panel does the same.
- **The picking wait** (`AskPickingWait`; the hand-off's mp4):
  - It's a small muted list in 12.5px: "Choosing which overviews to read · A few seconds" on
    `picking`, then "Chosen" ticks and "Reading 5 overviews · Then the answer" names the titles
    from `picked`, 80ms apart, each with its thumbnail, 25px in.
  - The loader is the mark itself (354v):
    - While a step runs, its circle is an orange arc turning over the mark's bar.
    - Done, the circle fills with a white tick drawn in.
    - A step not yet started is faint and still.
  - Since OV-373 `picked` carries `looked`, and the second step reads "Looking across 112 overviews,
    reading 5 in full" (or just "Looking across 112 overviews" when nothing was picked).
  - Once the intro or a section arrives it folds into "Read 5 overviews" with a tick and a chevron.
    That line opens to the five as chips, and stays on each stored question, from its `picked`.
  - After 10 seconds still choosing, "Still choosing, slow connection".
  - Each step is announced once, never the titles. Reduced motion has no spin, slide or drawing.
  - A small library or project, read whole, has no picking: three dots, then the intro.
- **The answer** (`AskAnswer`) is the shared sectioned view, with each section's sources as other
  overviews' chips by relation, then the line from `stats` (`askStatsLine`: "Looked across 112 of
  your 223 overviews · read 5 in full", or "From 5 of your 208 overviews" on answers from before
  OV-373), then Copy and "Sources N". Each section
  lands whole.
- **The drawer** (`AskDrawer`, top left) holds New chat and every conversation on the device: the
  library's, each project's and each overview's (OV-363; `askChatsQuery` over
  `ChatStore.listEveryChat`, leaving out a deleted project's).
  - It's grouped Today, Yesterday, Previous 7 days and Earlier (`askHistoryGroups`). Each item
    shows its first question and its scope: "Your library", the project's name or the overview's
    title, on one line. A question cut off shows in full in a tip on hover or keyboard focus,
    and on touch only while pressed and held, a press that doesn't then open it (`CutText`, OV-371; §4.4 of the frontend architecture guide), as do the overview's Conversations list and the chat panel's title. There's no thumbnail (owner, 22 Nov 2026: no Design round).
  - A library or project conversation opens on the Ask page. An overview's opens on that overview,
    with chat open on that conversation (owner, 22 Nov 2026): the link carries the conversation id
    in its state (`conversationFromLocation`), the overview page opens it once chat is offered and
    the conversation is on the device, then clears the state so a reload or Back doesn't open it
    again. Chat's `opened` event says `from: "askDrawer"`.
  - Deleting a conversation from either list refreshes both, the overview's own and the drawer's.
  - Its ⋯ (on hover, on focus and on the open one; always on touch) has only Delete conversation.
    There's no Rename, because the title is the first question.
  - Deleting has Undo for six seconds, and the delete is made when the toast goes or the reader
    leaves.
  - On the web (354t-4) it's a raised 280px column down the left of the page, full height. The
    button that opens it is at the page's far left, with a panel icon, and the drawer closes with
    its own button.
  - Close and New chat stay pinned at its top as the list scrolls, with the fade under the bar in
    the drawer's own surface once it has scrolled (OV-371; `fade-under-the-bar.md`, whose
    gradient is now the `fade-gradient` mixin in `theme/stickyFade.scss`). The drawer doesn't use
    `data-sticky-fade` itself, since only the lowest band keeps that fade and it would take it
    from the masthead.
  - Opening and closing slide: on the web its width opens from the left with what's inside held
    at the open width, and on a phone the sheet rises over a fading scrim. Closing plays it
    backwards. It doesn't slide when it starts open, or with reduced motion (OV-371).
  - On the web it starts open whenever the Ask page opens (owner, 22 Nov 2026, OV-370); closed,
    it stays closed until the page is opened again. `drawer.opened` counts only the reader opening
    it.
  - On a phone it's a bottom sheet over a scrim, and starts closed.
  - The ⋯ menu (354t-6) is 220px and right-aligned. It opens below the ⋯, or above it when there's
    no room below, as for the last conversation in a phone's sheet (OV-362).
- **Waits** are the overview chat's (`ChatWaitBlock`), with 50 questions to a conversation. The
  meter line sits under the field on the Ask page too (376g), and when a library question won't
  fit but an overview question would, "Not enough chat left for a library question" takes the
  field's place and says questions about one overview still work until the reset (376h).
- **Events**, `ask.*`, never the question, the answer, a title or which project:
  - `page.opened`: from the top bar or a project, and over what.
  - `chat.*`: asked (typed or a starter, new conversation, pins and set aside counted), picked (how
    many, and `lookedAcross` since OV-373), answered (sections, overviews cited), answerFailed, waited, stopped, answerCopied,
    sourcesMenuOpened, readOpened, sourcePinned, sourceRemoved, overviewFollowed and plansFollowed.
  - `drawer.*`: opened, newChat, conversationOpened, conversationDeleted and deleteUndone. The last
    three carry `scope`: library, project or overview (OV-363).

## Over MCP

A connected assistant reads chats under `overviews:read` (OV-311; `mcp-connector.md`, "Chats"):
`list_chats` by overview, by project or across the library, `get_chat` with each citation as a
timestamp link, and a line at the end of `get_overview` naming its conversations. Nothing an
assistant can call writes to a chat. Since OV-353, `list_chats` names each chat by what it's over
("about <title>", "on the project <name>", "over the whole library"). Its `project` filter takes the
project's own chats as well as chats about its overviews, and `library: true` lists the library's.
`get_chat` reads a sectioned answer as numbered headings, each point naming the overviews it rests on.

## Privacy

`/privacy` has a section, "Asking questions about an overview", added with OV-309, which first
writes chats: what goes to OpenAI, that it is always on our key, how conversations are kept and
deleted, what is counted and logged. OV-320 added articles and recipe pages: their overview, and
a recipe page's recipe, go to OpenAI, never text from the page. OV-355 added other overviews: the
question goes to OpenAI for an embedding to search the library by meaning, and the other
overviews found or pinned go to OpenAI with the question. `/terms` names the allowance and
who can ask (`legal-pages.md`).
