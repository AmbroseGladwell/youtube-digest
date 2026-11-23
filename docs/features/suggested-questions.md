# Suggested questions

OV-350. Paid readers get suggested questions on the Ask page, in library chat and project chat.
Each question rests on two overviews whose ideas connect. The measurement behind it is OV-218,
`connections.md`, and its cost is in `docs/architecture/cost-model.md`, "Connections and library
questions".

Slice 1 is the record: where a question is kept, how what became of it syncs, and how it is
deleted. Slice 2 is the server's refresh, which finds the pairs and writes the questions in
batches. Slice 3 is the Ask page's logic, with nothing drawn yet, and slice 4 draws it to the
design round's hand-off.

## One record per question

A synced kind, `suggestedQuestion`, added at client version 30 (`sync-api.md`, "A kind a client
was built before"). Each record is one question:

- `id`: `suggestedQuestionId(scope, overviewIds, questionId)`, which is
  `library:<a>:<b>:<uuid>` or `project:<projectId>:<a>:<b>:<uuid>`, with the two overview ids
  sorted. The id carries the scope and both overviews, so the server finds them by pattern, as
  it finds chats (`chats.md`) and membership records (`projects.md`).
- `scope`: `{ kind: "library" }` or `{ kind: "project", projectId }`.
- `overviewIds`: exactly two different overviews, sorted.
- `text`: one sentence, 1 to 300 characters and at most `FOLLOW_UP_QUESTION_MAX_WORDS` (25)
  words, the same cap as a follow-up question (`follow-up-questions.md`).
- `madeAt`: when the server wrote it.
- What became of it, each null until it happens:
  - `shownAt`, the first time any device showed it;
  - `askedAt`, when the reader asked it;
  - `dismissedAt`, when the reader dismissed it;
  - `feedback`, `{ verdict: "none" | "glad" | "obvious", at }`. `none` clears a mark: Good question toggles (design 350, 23 Nov).

**Reader state, apart from the overviews.** A question is never a field of an overview, which is
replaced wholesale when it is made again (`CLAUDE.md`, the read and favourite lesson). A
regenerated overview keeps the questions resting on it.

**Live** means not dismissed and not marked obvious (`isSuggestedQuestionLive`). A question the
reader asked or was glad of is still live; whether it comes round again is slice 2's call. The
server reads the rest: obvious ones become examples of what not to ask, and dismissed or obvious
ones never come back.

## Who writes what

The server writes every question. `writeSuggestedQuestions` (`apps/api/src/questions/`) takes a
batch of new questions, each a scope, two overviews and the text, and writes each under a fresh
uuid at the server's own versions (`serverClientContext`) and clock, in one `records.write`:

- **Only while both overviews are there.** Each write requires both overviews, read in the same
  transaction; a missing or deleted one skips that question.
- **A project's question only while the project is there and both overviews are in it.** The
  write requires the project and both membership records, and skips the question unless both
  are in the project (`isInProject`).
- **A skipped question never fails the batch.** It comes back as `null` beside the ones written,
  in the order given. Text past its limits is skipped the same way, before the write.

A device changes only what became of a question, with
`PUT /api/suggested-questions/library/:a/:b/:uuid` or
`PUT /api/suggested-questions/project/:projectId/:a/:b/:uuid`: the id's parts as a path, since a
whole id is longer than the longest parameter Fastify takes. The body is a
`SuggestedQuestionChange`, any of `shownAt`, `askedAt`, `dismissedAt` and `feedback`, with
`updatedAt`. Nothing else is accepted: no route lets a device make a question, or change its
text, scope, overviews or `madeAt`. A question the server doesn't have, or has deleted, is
`not_found`, which the device's outbox takes as done.

## The merge

`mergeSuggestedQuestion` is shared by the device's store, the server's route and the rebase of a
pending change over a pulled copy, as `mergeProjectMember` is. It commutes, so devices that
change one question while apart settle the same whichever change arrives first:

- `shownAt`, `askedAt` and `dismissedAt` keep the **earliest** time seen. Once shown, asked or
  dismissed, a question stays so.
- `feedback` keeps the one with the **later** `at`, so a reader can change glad to obvious, or
  back, or clear it with `none`. A tie goes to obvious, then glad.
- Text, scope, overviews and `madeAt` are never touched.

## Deleting

Every sweep runs through `tombstoneLiveRecords`, after the parent's own write commits and on every
retry of it (`tombstoneSuggestedQuestions`). A question written before its parent went is caught,
and none can be written after, because the write requires the parent.

- **With either overview:** deleting an overview tombstones every question naming it, first or
  second, in the library or any project (`%:<overviewId>:%`). Ids are colon-joined uuids, so the
  colons on each side match only that overview.
- **With its project:** deleting a project tombstones its questions (`project:<projectId>:%`).
  The library's questions on the same overviews stay.
- **Leaving a project:** a membership change that leaves an overview out of a project tombstones
  that project's questions naming it, whether the reader took it out in the app or an assistant
  did over MCP. A removal that loses to a later add leaves them alone.
- **With the account:** questions are rows in `records`, which go with the account
  (`account-deletion.md`). `accountDeletion.test.ts` seeds one.

## On the device

`IndexedDbSuggestedQuestionStore` reads the `suggestedQuestions` object store (database version
9), keyed by id, with two indexes on fields already in the record: `byOverview` on `overviewIds`
as a multi-entry index, and `byProject` on `scope.projectId`, which the library's questions
don't have.

- `listSuggestedQuestions(scope)` gives the live ones, newest `madeAt` first. A project's come
  from its index; the library's from reading them all and keeping the library's, since a reader
  has a few dozen at most.
- `getSuggestedQuestion(id)` reads one, live or not.
- `changeSuggestedQuestion(id, change)` merges locally and journals the change, which the outbox
  pushes like any other. A change that changes nothing, or one to a question not on the device,
  journals nothing.

A device removes an overview's questions when it deletes the overview or pulls its tombstone, and
a project's when it deletes the project or pulls its tombstone, without journaling them, since
the server's delete takes them. A project's question on an overview taken out of the project
stays on the device until the server's tombstone for it comes down.

Nothing shows them yet.

## Slice 2: the refresh

The server writes questions only when the Ask page asks for them, a few times a week at most, so
nothing is spent on a library nobody opens and switching questions on costs nothing for an
existing library, whatever its size (`connections.md`, "Cost"). `SuggestedQuestionRefresher`
(`apps/api/src/questions/`) does the work. Every rule below is code with a named constant; no
model decides whether, when or how much.

### Trigger

`POST /api/suggested-questions/refresh`, signed in, with `{ scope: { kind: "library" } }` or
`{ scope: { kind: "project", projectId } }` (`SuggestedQuestionRefreshRequest`). The Ask page
calls it when the library or a project's chat opens. It answers **202** at once with
`{ status }` (`SuggestedQuestionRefreshStatus`):

| `status` | Meaning |
|---|---|
| `started` | a refresh began; any questions it writes arrive through sync |
| `free` | the account's plan doesn't have suggested questions |
| `capped` | this month's `questions` costs reached the cap |
| `busy` | a refresh for this account is still running |
| `not-due` | too soon, too many this week, or nothing new saved since the last |
| `unavailable` | this server has no OpenAI or Anthropic key of ours, or no meaning search |

The route awaits only the policy, never the writing: the refresh runs in the background and its
promise never rejects. A failure is logged (`api.questions.refreshFailed`) and the refresh row
marked `failed`.

### Policy

| Constant | Value | Rule |
|---|---|---|
| `QUESTION_PLANS` | BYO Plus, Plus | anything else is `free`, and nothing is recorded |
| `QUESTIONS_MONTHLY_CAP_DOLLARS` | $0.40 | this calendar month's (UTC) `questions` costs at or over it stop a refresh |
| `REFRESHES_PER_WINDOW` in `REFRESH_WINDOW_DAYS` | 3 in 7 days | rolling |
| `REFRESH_GAP_DAYS` | 2 | since the last counted refresh started |
| `REFRESH_STALE_MINUTES` | 15 | a refresh still `running` after this no longer holds the lock |

- **Something new.** A refresh starts only when an overview was saved or changed (its record
  stored) since the last counted refresh started, or there has never been one.
- **Counted** means the refresh labelled at least one pair, or is still marked `running`. One
  that found every slot taken (`full`) or no candidates (`no-pairs`) before calling a model
  doesn't count against the next.
- **One at a time.** The account's row is locked while the rules are checked, and a fresh
  `running` row is the lock. The cap is a design limit, not a spend figure (`cost-model.md`).
- **Opened scopes.** A paid reader's refresh records the scope it was asked from in
  `question_scopes_opened`, with the time. A project takes part only once its chat has been
  opened, most recently opened first.

Each refresh that passes the rules is a row in `question_refreshes`: when it started and
finished, the scopes it filled, the pairs it labelled, the questions it wrote and its `outcome`
(`running`, `written`, `full`, `no-pairs`, `failed`). Both tables go with the account
(`account-deletion.md`).

### Slots

A question is **used up** once asked, dismissed, marked obvious, or first shown more than
`SHOWN_QUESTION_LASTS_DAYS` (3) days ago (`isUsedUp`). The rest are unused, and on show.

| Constant | Value |
|---|---|
| `UNUSED_LIBRARY_QUESTIONS_MAX` | 6 unused library questions |
| `UNUSED_PROJECT_QUESTIONS_MAX` | 4 unused per project |
| `NEW_QUESTIONS_PER_REFRESH` | 6 in all |
| `NEW_LIBRARY_QUESTIONS_MAX` | 3 for the library |
| `NEW_PROJECT_QUESTIONS_MAX` | 2 per project |

`allocateQuestionSlots` fills the library first, then each opened project that isn't archived
and has at least `PROJECT_MEMBERS_MIN` (2) live members, until six are allocated. Nothing to fill
means no candidates are looked for and no model is called.

### Candidates

Found by code from the claim embeddings OV-229 stores (`search-by-meaning.md`), at each
overview's current rev only, and never from the big picture, as measured (`connections.md`). Two
overviews' distance is their best pair of claims, in pgvector (`ClaimPairsRepository`).

- **Library:** the `RECENT_OVERVIEWS_PAIRED` (20) most recently saved live overviews, and for each,
  from its `PARTNERS_LOOKED_AT` (10) closest: its `similarTo` links (`verdict.similarTo`), its
  closest partner sharing no topic, and its closest partner. The three lists are taken in turn,
  `similarTo` first since it was the best source, newest save first, each pair once.
- **Project:** every pair among its `PROJECT_MEMBERS_PAIRED` (30) most recently added live
  members, closest first.
- **Never twice.** A pair that has ever had a question in that scope, live, used up or
  tombstoned, is left out. Overviews that are gone are never candidates.

Up to `LIBRARY_PAIRS_LABELLED` (8) library pairs and `PROJECT_PAIRS_LABELLED` (4) per project
are labelled by Luna (`QUESTION_LABEL_MODEL`, chat's model), with the strict rubric of
`connections.md` round 2 (`LABEL_PROMPT`), the reader's About you and what was learned
(`composeReaderContext`, as chat sends it), the names and purposes of their projects, and for a
project's pair, that project. Only `real` ones are kept, `different_view` and `contradicts`
first, up to a scope's slots plus `SPARE_PAIRS_PER_SCOPE` (1) so the writer can skip one. The
measured prompt's "for you" line is left out, since nothing reads it.

### Writing

One call per refresh, with `QUESTION_WRITER_MODEL`: Claude Sonnet 5.5, on our Anthropic key
(`ANTHROPIC_API_KEY`), through `askClaudeForJson` with the reply held to its JSON schema. On the
owner's blind comparison of the same 16 pairs (23 Nov 2026), Sonnet wrote 15 questions, 10 the
owner was glad to ask and 3 wrong; GPT-6.1 Sol wrote 12, 7 glad and 5 wrong, mostly too specific,
though its wording was preferred where both were good. Labelling stays on Luna.

The prompt (`questionWriterPrompt`) is the measured one (`connections.md`, round 4) plus:

- each pair says how many questions its place can take;
- every question must draw on **both** overviews of its pair, since the obvious ones in the
  owner's review had dropped one;
- the reader's own questions marked obvious, the `OBVIOUS_EXAMPLES` (4) most recent, as "the
  reader found questions like these obvious";
- the questions on show in the scopes being filled, as themes not to repeat.

Each pair is sent compactly: its overviews' titles and core claims and the claims the pair met
on. Code then keeps a question only when its pair number exists, its text passes
`SuggestedQuestionText` and is one sentence, its pair hasn't a question already in this batch, and
its scope has room. The rest are written by `writeSuggestedQuestions`, which still skips any
whose overviews or project membership went meanwhile.

### Cost and logging

Every call is recorded in the cost tally under the area **`questions`**, at list price
(`modelPrices.ts`), as chat's are: `label`, `write`, and `label-failed` or `write-failed` for a
reply that billed but couldn't be read (`unit-economics.md`). Questions aren't counted against
the chat allowance.

`api.questions.refreshed` is logged for every ask with the plan and `status`, and again when a
started refresh ends, with its `outcome`, whether it filled the library, how many projects, the
pairs labelled and the questions written. Never a question, a title, an id or a cost.

## Slice 3: on the Ask page

Everything the Ask page needs, as app-core code with no components or styles:
`useSuggestedQuestions` (`features/chats/`), the pure set and paging in `askQuestionSet`, the
refresh call on `ChatApi`, and the events. Slice 4 renders it to the design hand-off: Claude Design
project 668753e1…, page "OV-350 1 Suggested Questions", frames 350a–350o (owner, 23 Nov 2026).
The library and each project use the same logic, keyed by scope.

### The set

- **The reader's questions first, then the template starters** (`askStarters`, unchanged), three at
  a time (`askQuestionSet`, `askQuestionPage`). The reader's are the device's live ones,
  newest first (`listSuggestedQuestions`), less any held for Undo. Whether one is used up is the
  server's call, not the device's.
- **A question waits for its overviews.** One whose overviews aren't both on the device is left out
  until they are. Each one shown carries both, resolved from the local library (id, title, kind,
  image), for the "This question draws on" menu.
- **Templates only**, exactly today's three, on a free plan, while the plan isn't known yet
  (`usage.plan`), and whenever there are none of the reader's own.
- **Different questions** moves to the next three and wraps after the last. The hook says which
  page of how many ("1 of 3"), and `canCycle` is false at three or fewer, which hides the button.
- **A card taken away lets the next move up** within the page on show. A removal that leaves fewer
  pages stays on the last there is.

### What the reader does to one

| Action | Writes | When |
|---|---|---|
| **Good question** | `feedback` glad, or `none` to take the mark off | at once |
| **Not useful** | `feedback` obvious | when Undo's 5 s are up |
| **Hide** | `dismissedAt` | when Undo's 5 s are up |
| **Asking it** | `askedAt` | at once |
| **Shown** | `shownAt` | the first time it is among the three on show |

- **The held write.** `dismissedAt` keeps the earliest time and syncs, and obvious stops a question
  coming back, so an undone removal must never have been written. Not useful and Hide take the card
  away at once and hold the change for `UNDO_QUESTION_MS` (5 s); Undo drops it unwritten. It is
  written when the time is up, at once when a second card is taken away, and at once when the page
  is left (unmount or `pagehide`), so nothing is lost. The toast and its Undo are slice 4's.
- **Asking one** gives back its text and both overview ids, which `useAskPage`'s `ask` pins for that
  question (its third argument), as the "@" pins do.
- **Shown** means on screen: the hook is told whether the questions are showing (the empty Ask page
  with no wait), and records `shownAt` only for the reader's questions in the three on show, once,
  and not for one another device already showed.

### The refresh call

`ChatApi.refreshSuggestedQuestions(scope)` posts to `POST /api/suggested-questions/refresh`. The
hook calls it once each time the page opens on a scope, signed in, never on a plan known to be free,
without waiting and swallowing any failure: questions arrive through sync, and what the server
answered matters only to its own log (`api.questions.refreshed`). The page isn't wired to the hook
until slice 4, so nothing is spent on questions no one can see yet.

### Events

`ask.questions.*` and `ask.question.*`, each with `plan` and `scope` (library or project), never a
question, a title or an id:

- `questions.shown`: a set of three on show, with how many are the reader's (`custom`), once per set
  while showing.
- `questions.differentPressed`.
- `question.asked`, with `kind`: `custom` or `template`.
- `question.markedGlad`, with `glad`, since Good question also takes the mark off.
- `question.markedObvious` and `question.dismissed`, sent when the held write is made, so an undone
  one is never counted.
- `question.undone`, with `action`: `notUseful` or `hidden`.
- `question.chipOpened`: an overview opened from the "This question draws on" menu, through the
  hook's `chipOpened`.

## Privacy

A refresh sends overviews' titles and claims, the reader's About you and what was learned, and
their projects' names and purposes to OpenAI, for a new purpose, so `/privacy` says so
("Asking questions about an overview", "Suggested questions") and the retention table lists the
questions (`legal-pages.md`, revision log, 23 Nov).
