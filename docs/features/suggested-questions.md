# Suggested questions

OV-350. Paid readers get suggested questions on the Ask page, in library chat and project chat.
Each question rests on two overviews whose ideas connect. The measurement behind it is OV-218,
`connections.md`, and its cost is in `docs/architecture/cost-model.md`, "Connections and library
questions".

Slice 1 is the record only: where a question is kept, how what became of it syncs, and how it is
deleted. Nothing writes a question yet. Slice 2 finds the pairs, writes the questions in batches
and decides which to show; the Ask page shows them after its design round.

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
  - `feedback`, `{ verdict: "glad" | "obvious", at }`.

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
  back. A tie goes to obvious.
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

## Privacy

This slice adds where a question is kept, how what became of it syncs and how it is deleted, but
nothing writes one until slice 2, which sends pairs of overviews to a model. `/privacy` describes
what the software does, so it changes in slice 2's PR.
