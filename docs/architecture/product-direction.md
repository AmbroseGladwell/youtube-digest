# Product direction: the layers, the library and the context engine

Written 7 Nov 2026, prompted by the closing half of
`docs/reference/chatgpt-overview-quality-and-context.md`. **Nothing here is decided.** It
answers one question the owner asked: how much of that direction already exists in this
repo, on the board, or in a decision, and how much is new.

Short answer: the layers exist as code without being named. The A-versus-B choice has
effectively been made by one sentence in `mcp-connector.md` and has never been examined as a
choice. Connection mapping does not exist anywhere, but three of its primitives do, and one
of them is already in the schema and untested.

## The four layers

The framework proposes capture, understanding, knowledge, intelligence, and argues the
interfaces will change while the library underneath is the durable asset.

**Nothing in the repo names these layers.** The packages are shaped like them anyway:

| Layer | What it is here |
|---|---|
| Capture | `apps/extension`, `apps/web`, `packages/app-core` capture and queue, `packages/articles`, `playlists.md` |
| Understanding | `packages/generation`, `packages/transcripts`, `packages/model-comparison` |
| Knowledge | `packages/domain`, `packages/store-local`, `packages/sync`, topics, tags, library filters |
| Intelligence | `mcp-connector.md`, the OAuth server, `/mcp` and its tools |

That the shape fell out of the build without anyone drawing it is mild evidence the
framework is describing something real rather than imposing a diagram. It does not follow
that the layers should be named in the code: the naming conventions here are about exports
and files, not about architectural tiers, and inventing a `layers/` folder would be a
pattern with no job (`docs/conventions/naming-conventions.md`).

What the layering is useful for is deciding what must not depend on what. One concrete rule
falls straight out and is already half-kept: **the knowledge layer must not assume the web
app is how it is read.** The sync record, the store conformance suite and the MCP tools all
hold to that today. The place it is least true is that topics and tags are shaped for the
library's filter rail rather than for an assistant's query.

## A versus B, and the sentence that already answered it

The framework names two versions of the product:

- **A, the personal knowledge library.** A good place to save, understand, organise and
  revisit. The assistant is one way to reach it.
- **B, the personal context engine.** A system that accumulates what matters to you, what
  you have learned and what you believe. Assistants are the primary way to use it.

Its own recommendation is to launch A and grow into B.

**This has not been framed anywhere in the repo.** But `mcp-connector.md` opens with a
sentence that decides a large part of it:

> The synthesis across many overviews happens in the reader's own assistant, on their own
> plan. This server only serves the sources and keeps the reader's marks.

That is a real architectural stance and a good one. It says the intelligence layer is
borrowed, not built: we do not pay for the reasoning, the reader's own Claude or ChatGPT
subscription does, and we compete on the quality and structure of what we hand it. It is
also the reason the MCP connector is free on every plan (`tiers.md`: the paid plans sell
volume, never features), which means a free reader already gets the whole B-shaped
experience.

So the position today is: **A as the product, B as the surface, and the reasoning rented
from whoever the reader already pays.** That is a stronger place to be than the framework
realises, and it is worth writing down as a decision rather than leaving as a scoping note,
because the obvious next features all threaten it. Every "ask your library a question"
feature built inside the app moves reasoning onto our bill and competes with the connector
that is already free.

The two risks it names are worth keeping:

- **Becoming a feature rather than a destination.** The counterweight here is that the
  library is useful without any assistant: read it, listen to it, filter it, share it.
  `README.md`'s own measure of success is time not spent watching, which needs no AI at all.
- **Depending on AI providers.** Partly answered: six providers behind one interface
  (`byo-providers.md`), model choice measured and rerunnable (`model-comparison.md`), and
  export already exists for an account's data (`account-deletion.md`'s neighbours). The
  weak point is MCP itself, which is one protocol, though the data under it is ours.

## Connection mapping

The framework's biggest single suggestion is connections across content: recognise that
five separately saved things share a theme, and answer a question across all of them with
links back to the passages.

**The owner's steer, 7 Nov 2026, and it narrows this usefully.** The connection worth making
is between **what the content is about**, not between its commercial pattern. Selling's typed
categories can be aggregated ("12 of your fitness saves push a paid programme") and that is
worth building, but it is a fact about the reader's saving habits, not a connection between
ideas, and it belongs with the verdict rather than in this section. The stated win is
narrower and harder: **connect ideas so they can be surfaced, asked about and carried into a
conversation as context, especially where the reader did not know the two things were
related.**

That splits into two jobs which need different machinery:

- **Retrieval.** The reader, or their assistant, asks and the right things come back.
- **Discovery.** Nobody asked. The product noticed.

### Retrieval does not work today, and the reason is specific

`search_overviews` and the library filter both match **literal words**. `searchLibrary.ts`
splits the query into words and requires every one of them to appear; `matchesLibraryFilters`
does `buildSearchHaystack(overview).includes(query)`. Topics are eight coarse buckets and
tags are the source's own vocabulary.

So the library can only be found by the words it happens to use. **That is precisely the
wrong instrument for the stated win**, because a connection a reader did not know about is
almost by definition one where the vocabulary does not match: an article on managed decline
in organisations and a podcast on why founders stay too long are about the same thing and
share no searchable words.

This is also why the MCP connector is weaker than it looks. The assistant can reason
brilliantly over whatever it is handed, and it is handed only what keyword search found.

### Discovery costs money, and that is a real decision

Retrieval can stay rented: better search means the reader's assistant finds the right
sources and does the thinking on its own plan, which is `mcp-connector.md`'s position
unchanged.

**Discovery cannot.** Noticing unprompted that two saves are related means we compare them
when nobody asked, which means we pay, which is a departure from "the synthesis across many
overviews happens in the reader's own assistant". It should be taken as a decision rather
than arrived at by building.

The cheap shape, and the one to cost before any other: **the claim is the unit, and
embeddings are the comparison.** The core claim and the key points are already propositions,
already extracted, already stored. An embedding per overview is a fixed, tiny cost paid once
at generation; comparing them is vector search, which costs nothing per query and nothing
per reader. A model is only needed to *say why* two things are connected, and that runs on
demand when a reader opens a connection, never across the whole library. That keeps the
per-overview cost near zero, keeps every connection explainable, and improves retrieval and
discovery with the same work.

### `similarTo` is not this

`similarTo`, similar past claims, is the one connection the product already tries to draw,
it is one of the four personal parts in `cost-model.md`, and the personal pass already pays
for it. It is also effectively untested: `cost-model.md` says so, because the sample reader's
five past claims shared nothing with the 20 videos and all 20 pairs tied.

But it answers "does this repeat something you already saved", which is a **sameness** signal
and reads as a verdict ("you already know this") rather than as a connection. The connections
worth surfacing are wider: the same idea from another angle, something that contradicts a
save, something that builds on one, two things answering the same question differently.

So measuring `similarTo` is still worth doing, and it is still the cheapest thing in this
area, but it validates a verdict signal rather than laying a foundation for connections.
Treat the two as separate work.

### Guards, whichever shape it takes

- **A connection a reader cannot see the reason for is worse than none.** The framework's own
  warning, and the right one: "avoid automatically generating thousands of meaningless links.
  Connections should be useful, explainable and searchable."
- **Connections are reader state, not overview state.** The overview record is replaced
  wholesale on regeneration, which is the lesson in `CLAUDE.md` and the reason
  `OverviewState` exists. Anything linking two overviews lives apart from both.
- **It degrades visibly** (`CLAUDE.md`, habit 3). A reader with ten overviews has nothing
  interesting to connect, and should see nothing rather than a feature that cannot work.
- **Measure before surfacing**, on OV-202's pattern. Whether a connection is right is
  judgeable, and a surface built on unjudged connections is an expensive way to display noise.

## What is already on the board, and what is not

Already there, and closer to this direction than it looks:

| Card | What it does for this |
|---|---|
| OV-168 Projects | the first grouping that says what an overview is *for*, exposed over MCP |
| OV-169 Home dashboard | the library as a place to return to rather than a list |
| Parking lot (card 98) | subscriptions, channel sync, custom prompts and templates, highlights, all from Recall's public roadmap |
| OV-109 (merged) | MCP writes: an assistant can mark overviews, so the connector is not read-only |

Not on the board anywhere: connection mapping, a cross-library question surface, the A/B
framing itself, or anything that captures what the reader thinks as opposed to what they
saved. The framework's point C, "remember what the user thinks, not just what they consume",
has no representation here at all: there are reader tags and a capture reason, and that is
the whole of the reader's own voice in a note.

## What is actually different here, in the age of AI

Added 7 Nov 2026, after the owner took sections 2 to 8 of the ChatGPT conversation as the
direction. That framing is good and it is also generic: it describes the personal knowledge
management category, and every tool in it could adopt the whole thing. What follows is the
part that is specific to this product, which is where the answer to "useful and powerful for
lots of people" actually lives.

### 1. The verdict is context-layer metadata, and nobody else has it

Every competitor in this space is built to make a reader feel good about saving. Readwise
hands an assistant highlights. Recall hands it encyclopedia entries. NotebookLM hands it
sources. **None of them says this one was thin, this one is selling you something, this one
contradicts the evidence.**

This product already does, and already hands it over: `search_overviews` returns the verdict
in its light listing, and `verdict` and `dubious` are both filters (`mcp-connector.md`). So an
assistant drawing on this library can weight what it finds, caveat a claim that came from a
dubious note, or skip the recycled ones entirely.

That is a real asymmetry and it was shipped without being named as one. **A knowledge base
where everything carries equal weight is worse than one where the weak material is labelled**,
and this is the only one of these tools that labels it. The outside conversation treats the
verdict as a reader-facing nicety and misses this completely.

It also resolves the fork from the other direction: the verdict is not a thing to trade away
for comprehension (`open-questions.md` #6), it is the thing that makes the comprehension
usable at scale.

Two things follow:

- **Selling's typed categories matter more than they looked** (`overview-generation-decisions.md`),
  not as a connection but as another quality signal on a claim. `compromises_content` is
  exactly what an assistant should know about a source.
- **It should be said out loud in the positioning.** "Your library, with the weak material
  labelled" is a sentence no competitor can write.

### 2. The volume tension, and why feeds are strategic rather than engagement

**A context layer gets better with more in it. This product is built to make you consume
less.** Time saved is the headline metric, watch it anyway defaults to No, and the verdict
exists to be unflattering.

Those conflict less than they appear, because triage reduces *watching*, not *saving*: the
verdict is precisely what makes a large, messy library tolerable. You can follow twelve
sources without drowning because something sorts them. **So triage is what makes volume safe**,
which reframes following playlists, podcasts and blogs from an engagement feature into the
thing that supplies the corpus.

**Where they genuinely conflict is the quota.** `tiers.md` sells volume by the overview: Free
5 a month, BYO Plus 10 plus 200 on the reader's key, Plus 50 a month. A context layer worth
asking questions of needs hundreds of overviews, and at 50 a month the top hosted plan takes a
year to reach 600. **The pricing is sized for triage volume, not corpus volume**, and that is
a decision already made that this direction contradicts.

The parking-lot card already holds the resolution, written down on 5 Oct 2026 and not
connected to any of this: "subscribed items arrive as cheap triage entries (title, source,
one-line premise). Only run the full overview and transcript fetch when the reader opens one."
A cheap entry is not an overview and need not cost an overview. That gives a library breadth
at almost no cost, with depth paid for only where the reader goes. **It is the single idea
that makes a context layer affordable under this pricing**, and it deserves promoting out of
the parking lot.

### 3. The context engine already exists, and it feeds one prompt section

The conversation's point C is remember what the reader thinks, not just what they consume.
**This is the part where the product is furthest ahead and least aware of it.**

`personalisation.md`, "A profile that learns", describes a system that is built and shipped.
Every three overviews a **profile pass** reads the reader's sentence, what is held, what was
removed and the 12 newest overviews, and proposes at most two items of 60 characters each.
Code does the counting: it dedupes, requires at least two overviews behind an item, writes the
provenance line ("From 4 overviews on app growth") and drops anything already held or removed
whatever the model says. `Settings.learned` is keyed by item with `removedAt` tombstones, so a
removal sticks and syncs. It is free, uncounted against the plan, capped at 30 a day, never
used before the reader has been shown it, undoable, removable in Settings, and switchable off.

**That is the personal context engine, in miniature, already running.** It is a continuously
updating model of what a reader cares about, built from behaviour rather than from a form,
with consent, provenance and removal. Nothing in either outside conversation describes
anything this careful, and the framework's recommendation to "progressively develop the
product into a context engine" is describing something that started a month ago.

Two things follow, and neither is on the board.

- **It reaches one section of one prompt.** `composeReaderContext` turns it into the line
  given to How to apply, and nothing else. It is not exposed over MCP: `learned` and `aboutYou`
  appear nowhere in `apps/api/src/mcp`, whose tools are the overviews, transcripts, topics and
  tags. An assistant that could read what this reader is focused on, learned from their own
  library and with its sources attached, is a far stronger context offering than a list of
  notes. It is also the most sensitive thing in the account, so it needs the reader's explicit
  choice rather than arriving with the connection.
- **Nothing measures whether it learns the right things.** There is no analytics event for the
  learned profile at all: not when an item is shown, undone, removed, or when Keep learning is
  switched off. `personalisation.md`'s own Analytics section covers the section toggles and
  About you saves only. **The removal rate is the quality signal**, it is free to collect, and
  it is the same evaluation gap `similarTo` has (OV-217).

**What is genuinely missing is narrower than point C suggests:** the reader's own words about a
particular thing. There is a capture reason, which asks for effort at the moment someone wants
to put their phone down and should be assumed to go mostly unused, and there are `userTags`.
There are no notes.

**Held deliberately, 7 Nov 2026.** The owner's call is to talk to real users before building
note-taking. That is the right order, and it is reinforced by the dependency: a reader's note
is only worth much once it can be a connectable claim alongside everything else, which is
OV-218. Build the connections first and a note becomes a small feature rather than a product.

### 4. "Lots of people" is a capture-habit question, and the answer is unplanned

Everything in sections 2 to 8 is about depth per reader. Reach is a different question and
the conversation touches it once, calls it input friction, and moves on.

**For this product the honest answer is that the saving habit is formed on a phone, and there
is no mobile plan anywhere.** Nothing in `v1-architecture-decisions.md`, no card, no doc. The
extension is excellent and it is a desktop artefact; most of the content this product is for
is watched, listened to and read on a phone, and the share sheet is where a save actually
happens.

No amount of knowledge-layer work compensates for a library that only fills when the reader
is at a laptop. Of everything in this document, this is the item with the largest effect on
"lots of people" and the least written about it.

### What this does not change

- **Rented intelligence stays the position** (`mcp-connector.md`). Nothing above argues for
  building reasoning into the app. The asymmetries are in what is handed over, not in who
  does the thinking.
- **The library has to be worth using with no assistant attached.** Still the most important
  constraint, and still `README.md`'s own measure.

## The first release, as it stands on 8 November 2026

Decided 5 Nov 2026 and **refined by the owner on 8 Nov 2026**. Recorded here because no doc held
it: it lived in card descriptions and in one session's memory.

- **The cohort is friends and family.** Not a wider hand-picked tester group. That is a smaller,
  more forgiving audience, and it changes what the release has to answer for.
- **The overview work comes first.** Improvements to the note land before anything is shared more
  widely. This is the sequencing decision behind the current sprint, and it reverses an earlier
  reading of this document that put instrumentation ahead of quality.
- Unlisted store listing, nobody pays, unchanged from 5 Nov.

**What that changes about measurement.** An earlier version of this document argued that
forward-only instrumentation had to land before any tester arrived, because evidence not
collected is evidence lost. That still holds in principle and is much weaker here:

- **The overlap rate is close to pointless for this cohort.** A handful of people who know each
  other will rarely save the same source, and the number only means something at scale.
- **Extension installs matter less** when you handed out every link yourself and can ask.
- **The profile keep rate still matters**, because each person generates their own profile and
  the signal does not depend on the group being large.
- **A structured way to report a problem matters less than it looked**, because friends and
  family will simply tell you. It is still worth having, and it is no longer close to mandatory.

**What it does not change.** `open-questions.md` #4, whether a reader trusts a verdict enough to
skip something on its say-so, is still the deepest untested question, and a small friendly cohort
is a weak test of it: people who know you are the least likely to tell you the verdict was wrong.
That is a real limit of this release and worth naming before conclusions are drawn from it.

## Decisions in flight, as of 10 November 2026

Added 10 Nov 2026 after a session with the owner that produced several cards in one day. Those
cards all point the same way, but five decisions are each being made across several of them, and
no card can see the whole of any one. Each section below says what is settled, what is open, and
which cards wait on it. **Writing this down decides nothing new.** Where a section proposes a
rule, it is marked as proposed.

**Cards should cite these sections rather than restate them.** That keeps the answer in one place,
and it means a card need not name other cards to be understood (until OV-268 lands, a card number
in a PR description moves that card to Done).

### 1. How a reader goes deeper than the overview

**Settled.** Reasoning is rented: the synthesis happens in the reader's own assistant
(`mcp-connector.md`, and "A versus B" above). The library has to be worth using with no assistant
attached. OV-235 is the card that writes this down as a decision.

**In flight, cheapest first:**

- **Follow-up questions that open the reader's own assistant** (OV-266). Three source-specific
  questions per overview, shown as chips that open Claude, ChatGPT or Gemini with the question
  filled in, or copy it. They add almost nothing to the overview's cost, and our bill pays for no
  answers. They work with no assistant connected, which is the risk OV-235 names.
- **In-app chat, priced before it is decided** (OV-267, an investigation). It reopens the
  position on purpose, with measured cost and quality per message, and decides build, defer or
  stay.
- **Explore further** (OV-233) is probably answered by the two above. Fold it in or close it once
  OV-267 reports.

**Rule.** OV-235 owns the answer. If OV-267 recommends building chat, OV-235's exception test
changes in writing first, with the reason, and the build cards follow from it.

### 2. Embeddings: what is embedded, what is shared, what stays private

**Settled, and built** (`search-by-meaning.md`):

- Each overview's big picture, core claim, each key point and a recipe's summary are embedded
  separately with `text-embedding-3-small`.
- The vectors are stored in pgvector on Neon and keyed by account.
- They are tied to the overview's rev, never synced, and never cross accounts.

**Proposed rule: claims connect, chunks prove and find.**

- **Claim vectors are the unit for connections** (OV-218), and they already exist.
  - Key points and the core claim carry the weight. A big picture matching another big picture
    says two sources cover the same ground, which helps project suggestions (OV-168) and can
    strengthen a key-point match. It is not a connection on its own.
  - **Never one vector per overview,** including by joining fields together before embedding.
    That brings back the coarse vector this doc and `search-by-meaning.md` already rejected.
- **Transcript chunk vectors, if OV-267 builds them, are made once per video and shared**, the
  way transcripts already are (`shared-transcript-cache.md`), because public captions are not
  personal. Cost then grows with videos rather than readers. They serve three jobs:
  - chat retrieval;
  - finding a moment the overview left out;
  - timestamps on each side of a connection as evidence.
- **Anything from the reader stays per account:** notes, chats, the learned profile, and their
  claims.

**Open:**

- Whether chunks are built at all (OV-267's answer).
- Whether How to apply is embedded, to connect actions across sources. Test it once connections
  exist.
- The privacy page lines if transcript text goes to an embedding provider (`legal-pages.md`'s
  trigger list).

`search-by-meaning.md` says the big picture is embedded, but its "Not built" list still has it.
Check the code and correct whichever is stale.

### 3. What an assistant may do: connector scopes

**Today.** `overviews:read`, `overviews:write` (marking read and favourite) and `profile:read`
(`mcp-connector.md`).

**Proposed writes, on several cards:**

- project create and membership (OV-168);
- saving a link, which spends generation (OV-262, idea 1, at a pace per connection);
- tags, a reader note, an outcome and a "this looks wrong" flag (OV-262);
- chats readable by the assistant (OV-267), and notes later.

**The owner's decision, still open: one write scope or two.**

- **One scope for everything additive.** Saving is controlled by the connection's pace and the
  month's quota.
- **Two scopes.** `overviews:write` for writes that cost nothing, and a separate scope for saving,
  so a reader can allow organising without allowing spending.

Whether chats and notes are read under `overviews:read` or a scope of their own is the same kind of
choice.

**Fixed either way:**

- An assistant never deletes, and never edits what the reader wrote.
- Every add is undoable and marked with the assistant that made it.
- A connection without a scope gets a plain "reconnect to allow this", not a failed call.

**Decide this before OV-168 ships its scope.** A scope a reader already approved can only widen if
they reconnect.

### 4. Reader records: one pattern for everything the reader adds

**The problem is known.**

- Set-valued fields do not merge across devices (`sync-metadata.md`; OV-21 is still open).
- The overview record is replaced wholesale on regeneration, which is the read and favourite
  lesson in `CLAUDE.md`.

**Proposed pattern, OV-168's.**

- One synced record per (thing, overview) pair.
- Adds are additive, and removals are dated rather than deleted.
- The record is kept apart from the overview, and carries who added it.

It applies to:

- project membership (OV-168);
- chats (OV-267);
- notes (not carded yet);
- outcomes, "did you try it?" (OV-262);
- tags an assistant adds (OV-262).

Connections (OV-218) are derived, like embeddings. They are probably server-side and not synced,
but that is to decide.

**Every new kind of reader record also:**

- is deleted with the overview and the account (`account-deletion.md`);
- is readable over MCP;
- goes into the export (OV-262, idea 2).

**Notes.** Section 3 above recorded on 7 Nov that notes wait until real users have been talked to.
On 10 Nov the owner said notes would now be useful, as their own card. Both hold: design chats and
notes together (both are the reader's own words, both readable over MCP), and decide whether to
build notes after the friends-and-family release.

### 5. Quota

OV-224 owns this, and three things wait on it:

- **Saving through an assistant.** A connection's pace still counts against the month.
- **Chat messages.** A counter on every plan, or fair use. `tiers.md` says plans sell volume, never
  features.
- **The comparison readers will make.** Plus is £7.99 for 50 a month. Recall Plus is $10 to $12 for
  unlimited summaries (competitor comment on OV-262, 10 Nov 2026).

Cheap entries for followed sources (OV-219, and "The volume tension" above) are still the idea that
makes volume affordable. **Answer it from what the friends-and-family cohort actually uses**, not by
matching a competitor's headline.

## A reading of the sequence

Not a decision. The order that respects what is already known:

1. **Write the A/B position down as a decision**, since it is already half-made and the next
   few features will test it. The sentence to defend is the one in `mcp-connector.md`.
2. **Measure `similarTo`.** Validate it against a reader whose library actually overlaps. It
   is the cheapest thing here and already paid for, but it validates a verdict signal, not a
   foundation for connections.
3. **OV-168 projects**, which gives connections somewhere to live that the reader chose,
   rather than somewhere the model guessed.
4. **Connections between ideas**, starting with the claim-level embeddings above, which fix
   retrieval and discovery together and are affordable per overview.
5. Only then a surface that draws the connections, with OV-202's discipline: measure whether
   they are right before building something that displays them.

Selling's pattern view is worth building and is not on this list. It is a fact about the
reader's saving habits rather than a connection between ideas, and it belongs beside the
verdict.

The thing worth protecting throughout: **the library has to be worth using with no assistant
attached.** The framework's closing line is the right one, and it matches `README.md`'s own
measure. If the web app is not good on its own, nobody accumulates enough for any of this to
matter.
