# Chats

OV-308, the first of four build cards for chat about one overview (OV-308 to OV-311). The
investigation behind them is OV-267, `docs/architecture/in-app-chat.md` (PR #343): GPT-6 Luna with the
whole transcript costs about $0.0003 a message, and answered only from the source.

This card is the record only. The endpoint that writes chats is OV-309, the panel inside the
overview is OV-310, and reading chats over MCP is OV-311.

## One record per conversation

A synced kind, `chat`, added at client version 22 (`sync-api.md`, "A kind a client was built
before"). Each record is one conversation about one overview:

- `id`: `chatRecordId(overviewId, conversationId)`, the overview's id, a colon and the
  conversation's own uuid. The overview comes first, so the server finds an overview's chats
  by the start of their ids, as it finds a project's membership records (`projects.md`).
- `overviewId`, and `startedAt`, the time of the first message.
- `messages`, in order. A reader's message is `{ from: "reader", text, at }`. An answer adds
  `citations` and `inSource`.
- **Citations are worked out by code** from the passages the model cited, never stated by it
  (`CLAUDE.md`, "Never let a model count, measure or time anything"):
  - `{ startMs, endMs }` for a stretch of a video or episode;
  - `{ paragraph }` for an article;
  - `{ chatId, message }` for a message in another chat about the same overview, by its
    place in that chat's `messages`.
- **`inSource: false`** marks an answer saying the source doesn't cover the question. Another
  chat is never the source: an answer resting only on one is not `inSource`.
- At most `MAX_CHAT_QUESTIONS` (30) questions and their answers, and 10,000 characters a
  message. A conversation past its length is refused whole, so OV-309 checks the count first
  (`chatQuestionCount`) and offers a new conversation.

**Never a field of the overview.** The overview record is replaced wholesale when it is made
again, so anything kept on it would be wiped (`CLAUDE.md`, the read and favourite lesson). A
regenerated overview keeps its chats: their citations point at moments in the source, which
don't move.

## Several chats, and one using another

An overview can have any number of chats, and each can draw on the others: a reader can
build on a decision or an answer from an earlier chat without repeating it. OV-309 sends
the overview's other live chats with each question, cut to a budget measured by code, oldest
first out. A deleted chat is never sent, so it can't come back through another one.

An answer that uses another chat cites it with `{ chatId, message }`, which code checks
points at a real message in a live chat of the same overview, as it checks times against the
transcript. An earlier answer is context, not evidence: a fact about the source still cites
the source. OV-310 shows the citation as a link to that message. Whether the reader can
choose what to bring in, instead of every chat seeing the others, is for its design round.

The citation is in the schema from the start, so adding it later needs no schema version
bump.

**Notes**, the reader's own writing on an overview, should take the same shape when they are
built: a per-overview record, synced, deleted with its overview.

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

## Deleting

- **One conversation:** `DELETE /api/chats/:overviewId/:conversationId` tombstones it. A retry of
  one already deleted answers 204. On a device, `ChatStore.deleteChat` removes it and journals
  the delete, which the outbox pushes like any other.
- **With its overview:** deleting an overview tombstones its chats, in a sweep run after the
  overview's own tombstone commits and on every retry of the delete (`tombstoneChats`, through
  `tombstoneLiveRecords`, which the membership sweep uses too). A chat written before the
  overview went is caught, and none can be written after, because the write refuses a
  deleted overview. This follows projects' membership records rather than sharing the
  overview's transaction, which would need the ids before the transaction opens. A device
  removes the overview's chats when it deletes the overview, or when it pulls the overview's
  tombstone, without journaling them, since the server's delete takes them.
- **With the account:** chats are rows in `records`, which go with the account
  (`account-deletion.md`). `accountDeletion.test.ts` seeds one.

## On the device

`IndexedDbChatStore` reads the `chats` object store (database version 7), indexed by overview:
`listChats(overviewId)` oldest first, `getChat(id)`, and `deleteChat(id)`. Nothing shows them
yet; OV-310 builds the panel.

## Privacy

This card adds where a chat is kept, how it syncs and how it is deleted, but nothing writes
one until OV-309's endpoint. `/privacy` describes what the software does, so it changes when
chats are first written: in OV-309's PR, which also sends the transcript and question to
OpenAI.
