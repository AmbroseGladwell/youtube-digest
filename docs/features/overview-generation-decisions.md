# Overview generation decisions, and what produced them

Recorded from a design conversation about the generation step for the real build, in
the same spirit as `docs/prototype/decisions.md` and `docs/architecture/v1-architecture-decisions.md`: a
decision, stated plainly, with the reasoning that produced it, not a spec.

## The composable prompt

**The prompt becomes a registry of named sections, not one template with
conditionals in it.** Each section carries its prompt text, the JSON schema field(s)
it produces, and whether it's structural or optional. A composer joins whichever
sections are enabled, in a fixed canonical order, into one prompt and one schema per
call.

**Structural vs. optional is a real split, not an arbitrary line.** Video info / In
one line / Core claim / Key points / Topic / Tags are the skeleton — there is no overview
and nothing to file without them, so they always run. Verdict, Selling, How to apply
(renamed from Try this — see below), and Watch-it-anyway are the opinionated layer —
exactly the four things README's own "Design principles" section calls out — and are
the four made toggleable, each defaulting on to match current behaviour.

**A toggle removes the field from the request, it doesn't ask the model to skip it.**
Since generation is moving to structured output (`docs/architecture/v1-architecture-decisions.md`
already decided this, to fix the markdown-parsing fragility `samples/` exposes),
"toggle off Verdict" has to mean the schema sent to the model has no verdict field
that call — not a prompt instruction the model could ignore. The alternative is a
control that looks off but isn't, which `docs/prototype/decisions.md` already rules out for
read/favourite/export ("a control that cannot work is worse than no control" — the
same is true in reverse of one that silently keeps working).

**Verdict's soundness check partly depends on Selling, and that's disclosed, not
hidden.** The prompt already asks Verdict to flag when "the creator is selling
something the advice conveniently requires." Turning Selling off has to turn that
check off too — running it silently in the background after the user turned it off
would be the same lie-about-what-the-toggle-does problem. The Selling toggle's UI
copy should say plainly that switching it off also weakens Verdict's
conflict-of-interest catch.

**This split is the same seam the cost problem in `docs/prototype/open-questions.md` #2
needs.** The unresolved hybrid there is "cache the objective analysis once,
personalise only actions/topic per user." Core/Key points is exactly the structural,
non-personal, cacheable half; Verdict/Selling/How-to-apply/Watch-anyway is exactly the
personalised half. Building the registry on that boundary now means the caching work
reuses it later instead of re-deriving it.

**Chapters joined the structural side, later.** Where a video's subject changes is a fact
about the video rather than a judgement for one reader, and the tab that shows them is
drawn either way, so there is nothing for a toggle to honestly remove. The section, the
shape and the reasons are in `docs/features/chapters.md`.

## The verdict scale: two axes, one blunt label

> **Superseded for novelty by `novelty-scale.md` (OV-83).** The scale below became Common
> knowledge / Fresh angle / Original, judged against the field and never against the
> reader's library. The `dubious` half and the `THIN` gate are unchanged.

**Evidence the single scale conflates two things.** Across the 30-note prototype
library, one bucket (`SOLID BUT FAMILIAR`) holds 77% and two buckets (`THIN`,
`DUBIOUS`) have never fired. Reading the actual reasoning text behind every
`samples/` verdict shows why: two of the three `SOLID BUT FAMILIAR` notes contain a
live soundness complaint the label can't express —

- fitness note: "the forearm anecdote offered as proof that arms recover fast is a
  joke, not evidence" — an overreach flag wearing a label that reads as endorsement.
- business note: "the UK claim in particular is a strong assertion with no
  counter-case offered" — same thing.
- parenting note: no soundness complaint at all, and the only one of the three where
  the label actually fits cleanly.

`DUBIOUS`'s zero count looks like conflation, not evidence the content is uniformly
sound: the model has somewhere to put "this is dubious" today, it's just called
`SOLID BUT FAMILIAR`. `THIN`'s zero count is more likely genuine (survivorship — a
video already chosen for saving is unlikely to assert literally nothing).

**Decision: split into a novelty label (primary) and a single binary flag,
`dubious` (secondary), plus a pre-check gate.**

- Novelty (always shown, one of): `NOVEL` / `ESTABLISHED` / `RECYCLED`.
  `ESTABLISHED` replaces `SOLID BUT FAMILIAR` — the stated dislike was the old
  phrase specifically, and one word that says the material is settled carries the
  quality judgment without the two-clause hedge. It was `COMPETENT, NOT NEW` first,
  which reordered the two clauses rather than losing them. Local stores written
  before the rename hold the old value, and library reads aren't re-validated
  against the schema, so the local database version was bumped to drop stored
  overviews and their read/favourite state on next open rather than migrate them —
  topics and settings (the API key) survive. See
  `packages/store-local/src/openLocalDatabase.test.ts`.
- Soundness collapses to one visible bit: `dubious`, present or absent, nothing
  else — see the next section for why a three-value version was considered and
  dropped. This matches the app's own existing badge vocabulary (`sells nothing`,
  `worth watching`): binary, rare, consistent, rather than a graded warning scale.
- `THIN` is not a fourth label. It's a pre-check gate: if Core Claim comes back
  empty/"pure vibes" (which the prompt's existing Core Claim instructions already
  detect), Verdict doesn't run at all and the overview says so. This wires an existing
  signal through rather than asking the model to separately remember a THIN verdict.

Re-scored, the five samples become:

| Note | Old label | New label |
|---|---|---|
| business/adaptability | SOLID BUT FAMILIAR | ESTABLISHED |
| finance/gap | RECYCLED | RECYCLED |
| fitness/arms | SOLID BUT FAMILIAR | ESTABLISHED |
| interesting/heartbeats | NOVEL | NOVEL |
| parenting/multiplication | SOLID BUT FAMILIAR | ESTABLISHED |

None of the five cross the `dubious` bar — it's meant to be rare. The overreach
complaints in the business and fitness notes ("no counter-case offered," "the
forearm anecdote... is a joke, not evidence") still show up, just in the reasoning
prose rather than as a badge — see the next section for why that's the right home
for them.

## Soundness collapses to one bit: `dubious`, and why the other two never surface

**The mechanism behind `dubious` matters, and it's weaker than the word implies.**
Nothing in the v1 architecture wires a search or retrieval tool into generation — it's
Claude-only, one shot per video (`docs/architecture/v1-architecture-decisions.md`). So "contradicts
mainstream evidence" is never a live check against anything current. It's the model
pattern-matching a claim against what it absorbed as "settled" during training, which
cannot distinguish three different situations: a claim that genuinely conflicts with
something the model has strong, confident support is settled consensus; a claim that
conflicts with something that *was* true at training time but has since been revised
(a stale-knowledge false positive); and a claim that is simply new, niche, or recent
enough that the model has no reference point either way — not contradicted, just
uncompared. `dubious` is an accusation (evidence says this is wrong), and only the
first of those three situations actually earns it.

**`dubious` still has to stay conceptually distinct from mere unfamiliarity, even
though neither `overreaching` nor "unverified" gets its own field.** The model has
to be able to tell "this conflicts with something I'm confident is settled, or is a
disclosed conflict of interest" apart from "this is just new, niche, or recent
enough that I have nothing to compare it against" — otherwise `dubious` would fire on
ordinary novel content, which is the opposite of rare. That distinction, and the
argument-quality read ("overreaching" — weak reasoning, anecdote-as-evidence,
independent of whether the claim is otherwise sound), stay real, both because they
shape what the model writes into `reasoning`, and because getting `dubious` right
depends on not confusing it with either. They just never become their own schema
field or badge.

**Decision: only `dubious` reaches the schema or the UI — checked against the app's
own badge vocabulary, not chosen in the abstract.** The prototype's existing badges
(`sells nothing`, `worth watching`, `read`, `favourite`) are all binary, rare, and
consistent — that's the vocabulary this product already trusts, and a three-value
soundness flag doesn't fit it. `overreaching` alone shows up in two of the five real
samples — a ~40% hit rate — which would make it an always-on badge, not a rare one,
rebuilding the exact failure this whole redesign escaped (`SOLID BUT FAMILIAR` at
77%). `dubious`, kept to the narrow "active conflict or disclosed conflict of
interest" bar, stays rare enough to still mean something when it fires. This also
dissolves the earlier open question of whether `overreaching` and "unverified" could
co-occur: with neither exposed as data, there's nothing left to combine — the
model just has to avoid mislabelling ordinary novel content as `dubious`, which is a
generation-prompt instruction, not a schema concern.

**Later: the flag says why, and is derived rather than asked for.** The model now lists
the claims that clear the bar, at most three, each with a basis (one of the same two),
a reason and the transcript segment where it is said, and `dubious` is whether that list
is non-empty. The flag is still one visible bit at the same bar; pressing it opens the
reasons. See `docs/features/dubious-reasons.md`.

**Decision: `dubious` doesn't suppress generation, it hides the result.** How to apply
is generated every time regardless of `dubious` — the schema doesn't conditionally
drop the field based on a value computed in the same call. When `dubious` fires, the
UI hides it behind a reveal by default (the same collapsed shape Watch-it-anyway's
yes/no already uses), rather than the overview silently contradicting itself by showing
suggested actions right next to a claim it just flagged as dubious. Chosen over not
generating it at all: `dubious` is rare enough that the token cost of always
generating it is small, and it avoids a second on-demand generation round-trip for
the (presumably common) case where the reader does want to see it anyway.

## "Try this" renamed to "How to apply"

**The name assumed one shape of action that doesn't fit every video.** "Try this,"
scoped to "the next 7 days," reads naturally for a habit-change suggestion (its
original use case: parenting, fitness, personal-growth content) but sits oddly against
a recipe, a technique, or a decision framework — content the deferred per-video-type
templates in `docs/architecture/v1-architecture-decisions.md` (recipe steps, process instructions)
already anticipate wanting to handle differently one day. "How to apply" is the
umbrella term that holds up across all of those without needing the templates built
first: it's neutral about what kind of action is involved, so it doesn't fight that
deferred idea when it eventually lands.

**Only the header changes.** The instruction underneath is untouched: 1 to 3 items,
concrete and specific rather than a principle, an honest "nothing to apply" instead of
inventing something. The renaming doesn't relax that — a recipe's "how to apply" is
still expected to name the specific dish, not "try incorporating more variety into
your cooking."

## Personal-library novelty, not just world knowledge

> **Narrowed by `novelty-scale.md` (OV-83).** Past claims still go into the call, but only
> to fill `similarTo`. The novelty label no longer draws on them.

**How the prototype actually produces "novel" vs. "familiar" today: almost entirely
the model's general sense of the genre, not a comparison against anything this
specific user has saved.** `summary-prompt.md` gives the model, per call, only the
video's own URL/title/channel/description and the user's save-time note — no prior
overviews, no library, no persisted user memory. The one apparent exception —
parenting/multiplication naming a specific other saved video by ID as making "the
same core claim" — isn't a designed feature. Nothing in the prompt or pipeline asks
for cross-referencing; the only explanation that fits is that both videos landed in
the same batch-processing run and so shared a context window incidentally. A
near-duplicate saved three weeks apart would get no such flag under the current
pipeline.

**Decision: add real personal-library retrieval, gated on the Verdict toggle.**
Before generating Verdict, read the user's own past `claim` fields (already stored
per overview, confirmed in `samples/records/*.json`) and pass them into the same call, so
"recycled" can mean "you already saved this," not only "this genre repeats itself."
If Verdict is off, this doesn't run either — no reason to spend the tokens fetching
and injecting past claims for a field that isn't being generated.

**No embeddings, no vector index, for v1.** A personal library's claims are one
sentence each; even a few hundred overviews is a few thousand tokens, trivial next to the
~30k-token generation cost already paid per video. Comparing a new claim against a
few hundred known strings is a well-grounded version of the same semantic-similarity
judgment the model already makes against the entire genre from training data — not
the class of unreliable operation `docs/prototype/constraints.md` warns about (that rule is
about a model fabricating a count or measurement, not about it making a judgment call
it's actually suited to).

**New structured field: `similar_to: [{ overview_id, title }]`, empty when nothing
matches.** The parenting-note cross-reference currently only exists as a sentence
buried in Verdict's reasoning prose — easy to miss. As a structured field, the
library UI can render an actual "You already have an overview like this →" chip, turning
an accidental one-off into the "surface the pattern, not just the item" feature
README already wants.

**Left deliberately open: at what library size does a flat claim list stop being
cheap enough to paste into every call, and does topic-scoped filtering become
necessary then.** Not answered by guessing — `docs/prototype/constraints.md`'s rule that no
figure shown to a user (or relied on for a capacity decision) should be a model's
estimate applies here too. Ship the flat-list version, measure real token cost
against the real library size once one exists, decide then.

## Topics: user-defined, not a fixed enum

**The prototype's Topic section is a fixed 8-category enum baked into the prompt**
(parenting, finance, business, fitness, relationships, personal-growth, interesting,
unsorted), each with its own guidance and, for parenting, a hardcoded reference to
the user's two children. That doesn't survive a multi-user build: topics need to be
something each user defines for themselves, not a taxonomy we impose.

**Decision: topics are a per-user list, and filing is matching against it, not
classifying into a closed set.** At generation time, pass the user's current topic
names (plus any short description they've given one) into the same call the same way
past claims are passed for novelty, and ask which of them match — zero or more.
Zero means unsorted.

**Decision: topics are multi-select, not single-select.** The old fixed enum could
force single-select because its pairwise ambiguity was known in advance and
hand-solved: "a video about career decisions is business even when the reasoning is
financial." That rule exists in the original prompt because business/finance
confusion was apparently common enough to need calling out by name — which is itself
evidence the generic fallback ("ask what the video is actually about") wasn't trusted
alone to resolve it. The business/adaptability sample is a live case: career advice
that widens into debt-cycle economics and wealth-tax mechanics, filed `business` only
because that rule existed to say so. User-created topics can't get that treatment —
we don't know in advance which of a given user's topics will collide, because we
don't know what topics will exist. Forcing single-select onto categories nobody
designed to be mutually exclusive (a user's "fitness" and "morning routine" can both
genuinely fit one video) would be trading a solved problem for a harder, unsolvable
one. Multi-select sidesteps needing the general heuristic to be as reliable as the
curated rule it's replacing.

**Topic creation is always a user action — the model suggests, never silently
creates.** Left unconstrained, a matching step will happily invent "workouts" the day
after the user made "fitness," and "gym" the week after that — the taxonomy
fragments without the user ever deciding it should. Confining creation to an
explicit user action (accepting a suggestion counts) keeps the filter panel meaning
what the user put there.

**`unsorted` stays the fallback, and now covers two honest cases, not one.** It's
still "the model genuinely can't tell" (a failure state, used rarely, per the
existing prompt language), but it now also legitimately covers "doesn't fit any
topic this user has created yet" — expected and common for a new user with an empty
topic list, not a judgment failure. Under multi-select, unsorted is simply the case
where the match set comes back empty — no separate flag needed to represent it.

**Suggested topics are two different features, at two different moments, not one:**

- *Per-video, at save/review time*: this isn't a confidence threshold — there's no
  scalar the mechanism actually produces — it's binary. Whenever a video's match set
  is empty, or doesn't fully cover what the video is about, the model can additionally
  propose a label as a suggestion chip. Accepting it creates the topic and adds it to
  the overview's set; dismissing just means the overview doesn't gain that topic — it may
  still be filed under others, so declining a suggestion no longer means "stays
  unsorted" the way it did under single-select. Same "degrade visibly" shape as the
  rest of the UI either way: don't silently auto-create a topic, and don't leave the
  user with an unhelped gap either.
- *Pattern-level, from the unsorted pile*: periodically look across just the
  `unsorted` overviews' claims for a cluster and propose "N of your unsorted videos look
  like they're about X — create this topic and file them?" This runs against
  already-stored overviews as a library-level operation, not inside the generation
  pipeline, and is the "surface the pattern, not just the item" principle turned into
  an actual affordance instead of a phrase in README.

**Cold start: a small set of starter suggestions, not an enforced list.** The old 8
categories can resurface as one-tap "add this topic" suggestions during onboarding or
on an early save, but as suggestions a user can ignore entirely, not a fixed enum the
model is locked into.

**One retrieval mechanism, two uses — and now genuinely the same shape.** Matching a
new video against the user's existing topic list and matching a new claim against the
user's existing claims (the novelty section above) are the same operation: compare
one new item against a small user-owned list and return whatever matches, which could
be none. `similar_to` was already designed as a list from the start; topic-matching
returning a set brings it into line rather than introducing a second inconsistency.

**Flagged, not solved: renaming or merging topics later touches every overview that
includes it.** This has to be a targeted update to the topic reference on existing
overview records, not an overview regeneration — consistent with the existing lesson in
`docs/prototype/decisions.md` that user-facing state should be updatable without the generation
pipeline rewriting the overview wholesale. Multi-select doesn't change this, it just means
the update touches a set membership instead of a single field.

**Resolved: Topics and Tags stay separate, on different grounds than either of us
first assumed.** Multi-select made them look structurally identical — both are now
sets of labels on an overview — but `prototype/index_template.html` already draws the real
line, and it isn't about structure, it's about interaction: Topics render in the
clickable header meta area, Tags render as plain, non-interactive spans in the
footer (the CSS tokens even group tags with the other non-interactive badges).
**Decision: Topics are the interactive filter — the thing shown and chosen in the
filter area — Tags are not.**

That check also found the prompt's actual stated reason for Tags doesn't hold up.
"3 to 6 lowercase tags for search" implies they add search coverage, but the
prototype's own `haystack()` function already concatenates title, channel, synopsis,
claim, reasoning, try, selling, myNote, points, topic, and verdict — essentially the
whole overview — into the searchable text. Checked against all five samples, every tag's
concept already appears as plain text somewhere else in the same overview, including the
one that looked like a real counter-example: the parenting note's `mtc` tag is already
spelled out verbatim in its How-to-apply section ("Year 4 Multiplication Tables
Check... MTC age"). Tags add no search recall the rest of the overview doesn't already
provide.

**Superseded by OV-84 (`tag-reuse.md`):** tags are now kept consistent across a library and
link overviews that share a subject, so the paragraph below, and its conclusion that tags need
no consistency or dedup, no longer holds. It is kept as the reasoning of the time.

**Decision: keep Tags as-is, as a scanning aid, not a search mechanism.** The visible,
non-interactive badges are genuinely useful for quick recognition on their own
merits — that doesn't need "for search" to be true to justify keeping them. Nothing
about the generation prompt or the schema needs to change; what should change is the
prompt's own stated rationale, since it currently describes a job the tags don't
actually do. This also means Tags don't need the consistency/dedup retrieval built
for Topics — a scanning aid tolerates "ai" on one overview and "artificial-intelligence"
on another in a way a click-to-filter facet couldn't.

**Decision: users can add their own tags, stored apart from the overview, not merged
into `Overview.tags`.** The reason to allow this isn't fixing bad auto-tags — it's that
a user might want to record something the model has no way to know, like "re-watch"
or "disagree with this," their own relationship to the overview rather than a
description of its content. Putting a user-added tag into `Overview.tags` would repeat
the exact bug `docs/prototype/decisions.md` already names for read/favourite: the
overview gets replaced wholesale on regeneration, so anything stored on it is silently
wiped the next time the model runs. `OverviewState` — the same per-overview, keyed-apart
store already holding `read`/`favourite` — gains a `userTags` field instead, updated
through the same `setOverviewState`, so a user-added tag survives a regeneration that
produces an entirely fresh set of model tags. Displayed as the union of `Overview.tags`
and `OverviewState.userTags`, same non-interactive badge treatment either way — the
split is about where it's stored, not how it looks.

## Selling: one card label, richer data underneath

**Same prose-parsing fragility as Verdict had.** `digest_note.py` derives its `sells`
boolean by checking whether the text starts with the literal string "nothing
detected" — a generation that phrases the none-case any other way ("None found," "No
pitches detected") would silently flip it wrong. Same class of bug
`docs/prototype/constraints.md` already names for Verdict's label-parsing, same fix: a
structured field, not a string sniffed from prose.

**The deeper problem: Selling's stated purpose is cross-overview pattern-detection, and a
free-text block can't be aggregated.** `docs/prototype/decisions.md`: "the value is the pattern
across many notes, not the individual flag." The five samples show genuinely
different patterns sitting undifferentiated in one prose field — a free personality
quiz (business), four paid programmes plus an app (fitness), a disclosed sponsor
segment (interesting), a free lesson that funnels into a paid curriculum (parenting).
You can't compute "23% of your fitness saves push a paid programme" from a paragraph.

**Decision: typed categories, not a bigger card, and not more prose.** Selling
becomes `type: own_paid_product | own_free_promotion | sponsor_or_affiliate | none`,
plus a `compromises_content` boolean carried over from the interesting note's own
judgment call ("neither distorts the argument") — the exact signal Verdict's
`dubious` flag already depends on (see the composable-prompt section above), now a
field instead of prose Verdict would otherwise have to re-read. But this richer data
is deliberately not all shown at once, or shown per-card:

- **The card gets exactly one consistent signal**: a single "💰 Selling" chip, present
  or absent, the same shape every time — no per-category badges, no severity marker.
  This is the direct answer to not wanting cards to accumulate labels, and it matches
  a real usage signal: Selling prose was the section most often skipped on a
  per-overview basis, which fits — a single data point in isolation is low-value, the
  pattern across many is the point, and a card is read one at a time.
- **The category still exists, just not as card real estate.** It lives in the
  expanded overview (one structured sentence instead of today's paragraph) and in a
  stats/pattern view — "12 of your fitness saves push a paid programme," "you keep
  hitting the free-lesson-sells-the-execution pattern" — which is where the
  aggregate signal actually earns its keep. This is the same shape as the existing
  "Statistics describe what is on screen, not the whole library" decision: a light
  signal per item, richer computation in the view built for it.
- **`compromises_content` never gets its own card badge.** It's purely an input to
  Verdict's `dubious` flag, which already has a badge — showing it twice would be the
  clutter this was trying to avoid in the first place.

**Decided: engagement-bait is excluded from Selling, full stop.** The fitness note's
Verdict text flags "invites comments and gym recommendations to drive engagement" —
that's not selling anything (no product, no charge, not in the prompt's own
definition), so including it was scope drift, not a real fourth category. Unlike the
soundness-flag split earlier in this doc, this isn't a case of a real signal needing
its own bucket: engagement-bait is baseline behaviour on close to every YouTube video,
so flagging it would fire almost everywhere and discriminate nothing — the same
failure mode that made the old single-verdict scale useless at 77% in one bucket.
Nothing to track, nothing parked for later.

## Watch it anyway: a real gap the samples expose

Four of five samples are clean, well-justified No's — including the fitness note,
where the "physical technique I'd perform wrong from text" exception plausibly could
have applied and didn't, which is the bar working as intended.

**The one real Yes doesn't fit the binary schema.** The heartbeats note: "Yes, but
only for one section... The rest of the video, including the billion heartbeats
result itself, reads perfectly well here." Forced into strict Yes/No, that answer
collapses to a bare Yes, which tells the reader to watch the whole video — the exact
"a soft yes costs the reader ten minutes" failure the feature exists to prevent. This
isn't a new idea — `docs/architecture/v1-architecture-decisions.md` already lists "suggested
timestamp ranges for a partial watch-it-anyway" as deferred (Idea 14) — but this
sample is evidence the need shows up today, in the only real Yes in the set, not only as future polish.

**Decided: add `partial` now.** `answer: yes | no | partial`, with an optional
`range: {start_ms, end_ms}` when partial. This is affordable specifically because
every transcript source carries YouTube's own per-segment start/duration timing
(`docs/features/transcript-retrieval.md`) — the model reads
an offset already present in its input rather than measuring or estimating one
itself, so this doesn't trip the `docs/prototype/constraints.md` rule against a model
counting/timing something. Reason text still does the descriptive work ("the
fractal-folding section"), the range just makes that description seekable. Chosen
over waiting for a timestamp-seeking UI to exist first: the range is cheap to capture
now and otherwise old verdicts would need re-generating later just to backfill it.
This doesn't touch the transcript-only blind spot from earlier in this section — the
model still only ever sees caption text at that offset, never the frame — it only
fixes where a real Yes or partial-Yes can point to.

## In one line, Core claim, Key points

> Each key point now also carries the stretch of the video it comes from, as segment
> numbers resolved to times by code. See `novelty-scale.md`, "What stands out".

**In one line's "roughly how long" clause has been dead instruction from the start.**
The prompt asks for three things — who's talking, roughly how long, and what
territory it covers — and zero of five samples state a duration, not even
approximately. That's not the model skipping the instruction; `docs/prototype/open-questions.md`
#3 already established the prototype's transcript source exposed no duration at all,
so there was never a real number to report, and `docs/prototype/constraints.md`'s rule against
fabricating a measurement means the model correctly never guessed one instead. This is
the third thing real caption timing fixes for free, alongside video runtime and
Watch-it-anyway's range: once real segment timing exists, this clause finally has
something to point at.

**Decided: the creator's name lives only in `Channel`, never repeated in `In one
line`.** The samples were inconsistent — "Ryan Humiston," "Veritasium" named outright,
but "a finance YouTuber," "a presenter" elsewhere — even though there's already a
dedicated field for it. One place, consistently, rather than per-overview judgment calls.

**Decided: Core claim gets an explicit word cap — 60 words, maximum.** Measured
against the samples (34, 36, 40, 40, 55 words, all uncapped, against `In one line`'s
own explicit 25-word limit), a 60-word ceiling doesn't tighten current practice — every
sample already sits under it. That's deliberate, not an oversight: it's a backstop
against the sentence eventually running to 80+ words, not a correction, because a
fuller claim is judged worth keeping here for the clearer picture it paints, unlike
`In one line`, which is a compressed at-a-glance label with no such need. The two
sections are capped for different reasons at different heights, not the same reason
at different heights.

**Key points' "3 to 5 bullets" instruction is already being violated, and doesn't need
a fresh decision to fix.** The interesting/heartbeats note has six. Under free-text
generation this is just a request; under the structured-output schema already decided
for the real build, it becomes an actual array constraint (`minItems: 3, maxItems: 5`)
rather than something to hope for. Worth recording as one more concrete reason for
that already-made choice, alongside the parsing-fragility one earlier in this doc: it
doesn't just stop misreading what the model said, it stops the model quietly
exceeding its own stated bounds.

**That turned out to be half true: the array cap is checked, but the model never
sees it as a constraint.** Structured outputs don't support array length constraints,
and the SDK's Zod-to-JSON-Schema step strips `maxItems` out of the schema it sends,
leaving only a description string. So the cap is enforced the same way the word caps
and the chapter ordering are: `generateOverview` parses the response itself and asks
once more on a violation. The first real failure was a two and a half hour parliamentary
debate, where the model sent more than five points and did so again on the retry. Two
things were wrong. The prompt said "3 to 5" without saying what to do when a long video
has more, so the model reasonably kept them. And the retry re-sent the whole prompt
with a one-line note appended after the transcript, asking for a fresh generation, so
the model faced the same long transcript and the same judgement again.

**Decision: the retry is a correction, not a regeneration, and the prompt owns the
long-video case.** The retry now sends the previous attempt back as JSON, names the
violations, and asks for that same response with only those fixed, with a rule for the
two shapes a cap failure takes: a list that is too long keeps the items that matter
most, a field that is too long keeps its meaning and drops words. The cap itself moved
from 5 to 7, a hard maximum with "most videos need five or fewer" kept as the
guidance: the debate genuinely had more than five things worth taking, and a ceiling
the model keeps breaking on the videos that most need a digest is the wrong ceiling.
Key points' own instruction then said seven is the ceiling however long the video is,
and that chapters carry the rest of the structure. OV-87 kept seven for a video up to
6,000 words and raised it for longer ones ("One note budget", below). What was rejected: truncating the
list in code after a failed retry, which would pick by position rather than by weight
and hide the loss; and a second retry, which spends another full pass on a model that
has already been told twice. This is also why `anthropicGenerationClient` uses `messages.create`
and not `messages.parse`: `parse` throws away the whole response on any client-side
check, and a response that is nearly right is the thing the correction pass needs.

**Decision: key points are written to be heard, without losing what made them
worth having.** Narration reads each point after a linking word ("First,", "Then,"),
so a point has to be one to three complete sentences that make sense heard on their
own, never a fragment, a numbering or a label and a colon. A first version also banned
parentheses and asked for numbers written as they would be said, with a 35 word cap
and one or two sentences. The resulting points were cleaner to hear, but they had
lost detail. The old points had packed two or three ideas each behind semicolons and
colons, and with those gone the model kept to the cap by dropping content, not by
tightening. The heartbeats note lost its whole "the theory is contested" point; the
finance note turned "she claims a lifetime of upgrades costs $200,000" into a plain
fact; the arms note went from three body-position cues to one. Losing a caveat or
the source of a claim is the worst thing a note like this can do.

So the prompt now says what to keep: names, numbers, dates, studies and the concrete
cues or steps, always any caveat or counter-argument the video raises, and who claims
something when the video presents it as one person's claim. A further sentence is
there for the specific detail rather than for restating. Numbers, money and symbols
stay as digits and symbols, because they read better on screen, and speech converts
them in code (`docs/features/tts-pre-rendered-speech.md`, "The spoken script").
Brief parentheses are allowed only for a year or a citation, and speech drops them.

**Decision: the word cap is a target in the prompt and a looser limit in the
schema.** The prompt asks for 40 words a point; the schema refuses only over 50.
How to apply items work the same way, at 30 and 40. Run against the samples with
40 enforced, one generation failed outright: a key point was still over 40 words
after the correction pass. A note failing over a few words is worse than a slightly
long point, so the hard limit is now only a guard against a point running away, and
it's the target that sets the length. At 40 words the narrations run about 15%
longer than before this change, against about 20% at 45.

**Decision: In one line works the same way, at 25 and 35 (OV-252).** The 25-word cap was
the one rule Claude kept breaking. Measured on 9 Nov 2026 with the comparison harness, two
runs a side as the sample reader: Sonnet 5.5's first one-liners ran to a median of 26 words
and at most 30 (34 with the schema in the prompt), where GPT-6.1 Sol's never passed 24. 28 of
Sonnet's 29 correction passes were for it, and the 12 overviews it failed outright were all
still over after the pass, by a word or two. So 25 stays what the prompt asks for and what
keeps a library row scannable (`docs/architecture/overview-quality.md`); the record refuses
only over 35, as a guard against a runaway. The library row clamps to two lines either way.
Overview schema version 14 alters nothing and holds these records back from clients that
still refuse 26 words (client version 15).

Measured again on Sonnet 5.5 after the change, the same sets and reader: 52 of 52 written,
51 first time (before: 39, 22 first time, 12 failed), at $0.055 an overview against $0.085.
Everything else held: every key point, what stands out and partial watch with its stretch,
every recipe found and both non-recipes left as notes. The cost is in the line itself: 37 of
Sonnet's 52 one-liners are over 25 words (median 26, longest 33), where the correction pass
used to trim them to 25 or fail. Sol is unaffected, since its prompt didn't change and its
one-liners never passed 24.

**Decision: verdict reasoning never opens with the novelty word, and the watch-anyway
reason never restates the answer.** Narration says the answer itself before the
reason, and leaves the novelty label on screen only, so either repetition would be
heard twice or out of order.

**Decision, 8 Nov 2026 (OV-214): key points are chosen by significance, not by
sequence.** Until now the rule only took things away. It stripped the hook, the story,
the restatement and the call to action, then capped the count. Nothing said which of the
points left over mattered, so on a long source the model followed it from start to
finish and ran out of points. The prompt now gives a reason to choose: what the rest of
the source depends on, and what is genuinely new, surprising or contested. It also
leaves out anything the reader could work out from the premise alone. On a long video it
says to weigh the whole of it first, because the idea that matters most may come in the
second hour. Then the points are given in the order the source makes them. Narration's
"First," and "Then," imply that order, and keeping it means only the choice changed.
Articles get the same rule.

- **"Has evidence behind it" was considered and left out.** It would drop a source's
  main unsupported claims, and the reader most needs to hear those, with the verdict's
  judgment of them.
- **The anecdote rule went in beside "who claims it".** When a source generalises from a
  single story or case, the point says it rests on that case. It isn't `dubious`: that
  flag means contradicted or self-serving, and "rests on one story" is unsupported rather
  than wrong. Folding it into the flag would make the flag noisy, and the flag is only
  believed because it is rare (`docs/architecture/overview-quality.md`, "Trust").
- **On articles, proportional coverage wins where the two rules fight.** A chapter
  holding over a quarter of the piece, and the last third, are checks in the schema
  (`article-notes.md`, "Coverage without a rewrite"). They set a floor, and significance
  chooses everything above it. Video has no such check yet. OV-87 ports them.
- **Grouping into themes was not taken up.** Chapters already are the grouping
  (`overview-quality.md`, "Decided 8 Nov 2026: ten points, and no grouping").
- **Recipes have no key points**, so the rule doesn't reach them.

This came before OV-87's budget on purpose: this card changes *which* points, OV-87
changes *how many*. Measured on GPT-6.1 Sol (`docs/architecture/model-comparison.md`,
"Results: significance over sequence, OV-214"):

- **Long sources cover more.** It held on both samples of each prompt.
- **Short ones are unchanged within run-to-run noise.**
- **The judges can't separate it from noise.** The whole-note judge called it level, on fields
  this change doesn't touch. A judge that sees only the key points leaned against the new prompt,
  but it leaned as far between two runs of the old prompt. Where it does lean, it marks down
  caveats about evidence, which is the anecdote rule.
- **It costs the same.**

## The big picture

OV-225, decided with the owner on 8 and 9 Nov 2026 (`docs/architecture/overview-quality.md`,
"Three orienting fields that must not repeat each other"). A note had a label and a claim and no
ground under either. The big picture is that ground: what question the source engages, why it
matters, and what else it covers that the core claim, singular by design, cannot hold.

**The three-way split is in the prompt, not hoped for.** In one line says what the source **is**;
the big picture says what **ground** it stands on and what else is here; the core claim says what
it **answers**. The prompt tells the model that a big picture that could be deleted without losing
anything the other two say has failed, and that an empty one beats padding.

**The note opens premise, big picture, core claim, verdict.** Then key points, how to apply, what
it sells and watch it anyway, which stay last so the narration still ends on "the overview covers
it". The owner chose this over the card's recommendation (premise, verdict, big picture, core
claim):

- **The ground comes before the answer**, and the verdict after the claim it judges.
- **The premise stays first.** The owner first chose to show the big picture in the premise's place
  and the premise only when there was none, then put the premise back on 9 Nov 2026, after the
  harness runs below: the premise says what the source is, and the big picture follows it. The
  two sit next to each other, so the prompt's rule that they never repeat carries all the weight.
- **It relaxes the triage rule on long sources.** A long source's note now has a paragraph before
  the verdict, where the rule in `overview-quality.md` says the verdict comes before anything long.
  The owner accepted that for the ground coming before the answer.
- **An older note is unchanged.** It has no big picture, so it reads premise then core claim as it
  always did, and its spoken script, and so its cached narration, is the same.

**It is structural**, like the premise and the key points, not a section a reader can switch off.
**A recipe gets none**: it has no argument to set up, and its summary is already its orientation.
Articles get one on the same rule as video.

**Its length follows the source's measured words** (`bigPictureBudget.ts`), so a short clip grows no
preamble. It is the first field on OV-87's one budget, and moves into it when that card lands:

| Source words | Target | Sent back over |
|---|---|---|
| up to 1,000 (about seven minutes of speech) | none | |
| up to 2,500 | 35 | 44 |
| up to 6,000 | 60 | 75 |
| up to 15,000 | 90 | 113 |
| longer | 120 | 150 |

The prompt asks for the target and the schema refuses only a quarter over it, as for In one line,
because a hard cap a model must meet fails whole overviews. The record refuses over 160. A source
too short to earn one is told to leave it empty, and code drops it whatever the model wrote. The
first tiers were 600, 1,500, 4,000 and 10,000 words; on the 20-video set they gave a 12-minute
video 60 words before its claim, so they moved down one step before any run.

**In the schema it is a plain string, empty for none**, not a nullable field: each union grows the
grammar Claude compiles (below). Measured on 9 Nov 2026 with a 16-token reply, three times each, on
Claude Sonnet 5.5, Opus 5.5 and Haiku 5.5: the video schema with the big picture compiles every time,
for a reader with no topics, the sample reader (five topics, its claims and tags) and a reader
with 300 topics. **Four more string fields still compile and a fifth never does**, whatever the
reader. That room is what OV-250's steps block and OV-216's evidence have left between them.

**Measured on 9 Nov 2026**, the 20-video set as the sample reader, two runs a side, against two
runs of `main` with the same models (`judge-big-picture`, a judge from the other provider):

| | GPT-6.1 Sol | Claude Sonnet 5.5 |
|---|---|---|
| Notes that earned one and wrote one | 37/38 | 38/38 |
| Passes the deletion test | 36/37 (97%) | 37/38 (97%) |
| Names another thread | 31/37 | 27/38 |
| Describes the source instead of the subject | 0 | 1 |
| Words written, 35 target (16 notes a side) | median 27 | median 36, over in 8 |
| Words written, 60 target (18 a side) | median 40 | median 42 |
| Words written, 90 and 120 targets (4 a side) | 52 to 62 | 46 to 55 |
| Output tokens an overview, against `main` | +55 (+3%) | no change |
| Cost an overview, against `main` | $0.0299 against $0.0290 | $0.0564 against $0.0566 |

- **The split lands.** The two failures were short videos where the big picture restated the core
  claim's advice as principles. Every other one named the question, and most a second thread.
- **The targets are not what binds above the first tier.** Both models stop around 40 words when
  given 60, and near 60 when given 120, so a two-hour source gets about half what the ChatGPT
  example ran to (101 words, 30 of them new). Raising the targets would not lengthen them; the
  prompt would have to ask for more. Only the 35 tier pinches, and only Sonnet, by a word or two.
- **Nothing else moved.** Every other harness check, and every overview written, matched `main`
  within the usual run-to-run noise.
- Sonnet tends to name its other threads as a list ("River, affirmations, Goodhart's law,
  SpaceX-style pruning and refounding"); Sol writes them as a sentence.

**Where else it goes.** A share carries it, absent rather than null when there is none so a
copy's content hash doesn't move. The markdown export an assistant reads gives the premise and the
big picture both. Keyword search and the meaning embeddings take it as one more claim. Onboarding
lists it among the sections being written when the source is long enough to earn one (an
article's words, or a video of ten minutes or more), the teaser names it among what an account
opens when the overview has one, and a sample's card shows it among its sections. The home page's
example overview and its standfirst name it, and so does the voice sample line. Overview
schema 15 fills null on older records (client version 16).

## One note budget

**Every source is sized by one budget, `noteBudget.ts`, keyed on whether it is spoken or
written** (OV-87, 10 Nov 2026). It takes the source's length as measured by code (transcript
words, or an article's words) and gives the key points, their target length, the most
chapters and the big picture's target. Video and articles used to size themselves apart:
articles from `articleNoteBudget`, video from a fixed "3 to 7 points" and a "3 to 8 chapters"
hint at any length. Keying it on spoken or written rather than on the medium means a podcast's
transcript (OV-106) takes the spoken rows with no budget of its own.

| Up to words | Written | Spoken |
|---|---|---|
| 400 | 3 points × 25 words, 1 chapter | 7 × 40, 10 chapters |
| 1,000 | 4 × 30, 3 | 7 × 40, 10 |
| 2,500 | 5 × 40, 5 | 7 × 40, 10 |
| 6,000 | 6 × 40, 7 | 7 × 40, 10 |
| 12,000 | 8 × 50, 14 | 8 × 50, 14 |
| beyond | 10 × 60, 20 | 10 × 60, 20 |

**Up to 6,000 words nothing moved.** The owner's call: keep each kind's short rows as they
were and raise only the ceiling for long sources. A spoken source's chapter ceiling of 10 is
new, but sits above the "3 to 8" the prompt still asks for, so it bounds a runaway rather than
shaping a note. The point's word ceiling is still the target plus a quarter, so 50 for 40.

**Why seven stopped being right.** Seven came from a debate that needed more than five, and the
instruction leaned on chapters to "carry the rest of the structure". That promise is empty for
a listener: chapters are the reader's third tab and are never read aloud (`overviewNoteLines.ts`).
Since `open-questions.md` #6 was answered, an overview stands in for its source, and listening
is the realistic use, so on a two-hour source the key points are the whole of what anyone
hears. Seven points of 40 words was 4 minutes of speech for two hours of talk.

**Why ten and not more.** A two-hour source could afford twelve to fifteen points inside nine
minutes (`overview-quality.md`, "What scales and what does not"), but past ten a list read
aloud stops explaining and starts listing. Grouping points into themes was dropped: a new
output shape for a problem nobody has shown at ten. OV-228's blind listen is where it would
show up. `MOST_KEY_POINTS` holds the ten in the record, the share and the generation schema.

**Long sources only, for the rest too.** Above 6,000 words the prompt says the points must
represent the whole source through to its end, and that a point left out is lost to anyone
listening; chapters are asked to differ plainly from their neighbours, the navigation failure
a twenty-chapter list invites. Video also gets the two checks articles have had at every
length, on segment ranges: any chapter holding over a quarter of the words needs a key point
inside it, and a key point has to reach the last third, each sending the note back naming
what is missing. On video they apply only to long sources, so a short video's note and its
retry rate stay as they were.

**Not in it: density from chapter count.** `overview-quality.md` proposed letting the number of
chapters raise the allowance, so a short dense source earns more than a short slight one.
That would change short notes, so it stays on OV-203 to be measured alone.

**Recipe pages are on no budget.** Their note is one paragraph and the page's own recipe, with
no key points or chapters. A recipe video is a video, so it takes the spoken rows.

**The record.** Overview schema 16 alters nothing and holds ten-point notes back from clients
that still refuse more than seven (client version 17).

**The grammar.** Array maxima never reach Claude's grammar: `providerJsonSchema` moves `maxItems`
into the description. Probed on 10 Nov 2026 with a 16-token reply, three times each, at 1,000,
9,000 and 18,000 transcript words with every section on: the schema compiled 18 of 18 on Sonnet
5.5 and Opus 5.5.

**Analytics.** `capture.newOverview.finished` carries the source's measured words, the key points
and chapters the note holds, and the most key points its length allowed, so the dials can be
read against real notes. Counts only, and absent for a recipe page.

## Stress-testing against genres outside the samples

None of the five real samples are a narrative interview, an instructional video, a
lecture, or opinion/news commentary. Working through six hypothetical examples of
those genres against the design above found three real gaps, none of which need a
schema change — all three are generation-instruction fixes, to make when the actual
prompt fragments get written.

**Core Claim assumes video content is argument-shaped, and a lot of it isn't.** A
music-producer interview (narrative), a cooking video (procedural), and a news
explainer covering several possible outcomes (multi-threaded) all have real
substance without having one thesis to extract. `thin` was built as the escape
hatch for "asserts nothing," but none of these are vibes-empty — forcing them
through the current instruction risks either an invented thesis or a wrongful
`thin`. **Decision: broaden Core Claim's own instruction, not the schema.** The
field is still one string either way: "the single most important thing to take
from this video — the claim, if it's arguing one; the substance, plainly described,
if it's showing or explaining something instead; say so if it's neither." `thin`
stays reserved for the third case only, exactly as it is today.

**`dubious` needs a rule for contested and not-yet-resolved claims, not just novel
ones.** A named commentator's stated policy viewpoint, and a prediction about how a
new political leader might govern, both stress the same mechanism weakness already
recorded above (`dubious` is pattern-matching against training-time "settled"
knowledge, with no live check) in two new ways: economics and policy are contested
domains without a clean consensus to contradict, and a prediction about the future
can't be checked against anything yet — there's no fact of the matter to conflict
with. **Decision: `dubious` should fire on a mismatch between how much certainty a
claim is presented with and how much it has actually earned, never on a topic being
contested or an outcome being unresolved.** An explicitly-framed opinion or
prediction, argued as one person's view, isn't dubious for being uncertain — stating
a genuinely contested question as settled fact would be. This sharpens the existing
"don't confuse unverified with dubious" guardrail; it doesn't replace it.

**Novelty answers a different question for advice than it does for reference
content, using the same label.** For advice, "familiar" means "you can probably
skip this." For an MIT lecture correctly teaching standard material, `established`
is accurate but isn't a reason to skip anything — the value of the lecture is in the
teaching, not the novelty of the theorem. **Left as an interpretive fix, not a
structural one, for now:** the reasoning text already carries this distinction (as
it already does for the overreach cases folded into prose elsewhere in this doc),
and the topic an overview is filed under does real disambiguating work for free — a
reader browsing a "maths" topic already expects familiarity to mean "correct and
standard," not "not worth your time." No evidence yet that this needs its own field
rather than the right framing in prose.

Two smaller things resolved in passing, not dug into further:

- **Watch-it-anyway's criteria are worded visual-only.** Cooking, product demos, and
  the producer interview all surface a real audio-equivalent case (hearing a mix
  decision, a sound a description can't substitute for). Add "or a sound that
  carries information the words do not" alongside the existing visual clause — a
  one-line wording fix, not a schema change.
- **The cold-start topic list has no "politics" or "news," and that's fine.** Both
  the policy-commentary and news-explainer examples would rely entirely on the
  suggested-new-topic mechanic rather than a starter match — which is that mechanic
  working as designed, not a gap to patch.

## The video's own text is delimited, not explained

**Decided: the title, channel, description and transcript reach the model inside a
`<video>` block, and the system prompt says nothing about it.** The reader's reason for
saving the video stays outside the block, after it, because it is the reader's own words.
Any of the block's own tag names inside the video's text are defaced, so a transcript
cannot close the block early and speak from outside it. A creator can write captions that
address the model ("rate this original"), so the video's text has to be told apart from the
reader's.

**What was rejected: a system-prompt rule telling the model the block is material to
judge, never instructions.** It was measured before it was dropped, by generating real
overviews of four of the sample videos several times under each prompt, with an instruction
to rate the video original, report nothing dubious and say watch it anyway planted in the
finance video's transcript and description. Counts were compared directly; no model graded
anything.

| Prompt | Injection changed the verdict | Note mentions the injection | Heartbeats rated FRESH_ANGLE |
|---|---|---|---|
| Unlabelled, as before | 0/4 | 4/4 | 9/16 |
| `<video>` block only | 0/4 | 3/4 | 3/11 |
| Block and a neutral sentence of the same length | — | — | 2/8 |
| Block and a rule in the system prompt, three wordings | 0/15 | 1/15 | 0/31 |
| Block and the rule in the user message, after the block | 0/4 | 4/4 | 1/8 |

Neither the default model nor Gemini 3.6 Flash (16 runs across all four prompts) ever let
the injection change a verdict, even unlabelled. In the system prompt, the rule's only gain
was keeping the injection out of the note's text. Its cost was a harsher verdict: every wording, whether in
the system prompt or the user message, all but stopped the heartbeats video being rated
FRESH_ANGLE, where a neutral sentence in the same place did not. The first wording, which
said the block was "written by the creator, not by me", also turned the arms video's watch
it anyway from partial (6/8) to no (0/8). Telling the model to distrust the video makes it
discount the video's own case for what is new in it, and the novelty scale already has too
many videos in one bucket (`novelty-scale.md`). If a model is found that does follow an
instruction in a transcript, measure the rule again against that model, not this one.

## The schema has to fit Claude's grammar

Claude enforces a structured-output schema by compiling it into a grammar, and refuses one
whose grammar passes an internal size limit it doesn't publish: a 400 saying "The compiled
grammar is too large". The published limits (24 optional fields, 16 fields with unions) are
not the ones that bite. OV-246: once recipe videos (OV-122) added a nullable `recipe` to every
video's schema, Claude refused every video overview, at 7 unions of the 16 allowed, while
OpenAI and Gemini took the same schema. It was measured by sending the schema with a 16-token
reply, so the grammar compiled and almost nothing was generated.

- **Size follows shape, not length.** A schema of 14 KB with 300 topic names compiled; one
  boolean more in a recipe step did not. Unions cost the most, and a union nested inside an
  array item inside another union costs more again. Below the limit, compiling is not
  repeatable: the same schema with no topics passed once and failed later.
- **The video schema had no headroom.** Dropping any one field, even `thin`, got it under.
  Making only the recipe step plain got it under too, but two more string fields anywhere
  broke it again.

**Segment ranges are two plain indexes.** Every stretch of the video the model names (a key
point, what stands out, Watch it anyway's partial range, a recipe step) is `startSegmentIndex`
and `endSegmentIndex` on the item, with -1 for no stretch, rather than a range object that may be
null (`segmentRangeFields.ts`). That took four unions out. Code turns -1 back into no range
before anything is stored, so the `Overview` record did not change. Only the recipe, a recipe
step's group, what stands out and the suggested topic may still be null, and a test holds that
list. Measured headroom with the group nullable: three more string fields compile, six do not. After OV-225's big picture, four more compile and five do not ("The big picture"): more than the count above left, measured on a different schema and reader, so take the edge as approximate.

**A recipe step's group stayed nullable.** Made a plain string, empty for none, it left room for
six more fields, but GPT-6.1 Sol stopped naming the parts of a method: the party jollof's seven
groups, there in both runs before, were in neither. Given "a name or null" it names them again
(one run of two, where Sonnet 5.5 named them in both). Grouping varies from run to run either way.

Measured with the comparison harness on 9 Nov 2026, the 20-video set and the recipe set, two runs
a side, as the sample reader (`--reader sample`):

| | Sol, before | Sol, two indexes | Sonnet 5.5, two indexes | Sonnet 5.5, schema in prompt |
|---|---|---|---|---|
| Overviews written | 52/52 | 52/52 | 39/52 | 34/52 |
| Key points with a stretch | 94% | 97% | 100% | 100% |
| What stands out with a stretch | 18/18 | 18/18 | 14/14 | 12/12 |
| Partial Watch it anyway with a stretch | 2/2 | 2/2 | 2/2 | 2/2 |
| A "no" or "yes" given a stretch | 0 | 0 | 0 | 0 |
| Recipe steps with a stretch | 100% | 100% | 100% | 100% |
| Cost per overview | $0.030 | $0.029 | $0.085 | $0.091 |

Sonnet 5.5 on the schema before could not be measured: Claude refused all of it, with or without
a reader's topics. Sol was unchanged by the two indexes, and no stretch of -1 turned into a false
one at the start of the video. Every overview Sonnet 5.5 failed to write broke one rule: In one
line over 25 words, still over after the correction pass. Three more in the schema-in-prompt arm
were JSON with a sentence after it, which the adapter now reads past.

**When Claude refuses the schema, it is sent again in the prompt.** Headroom runs out as the
schema grows, so the Anthropic adapter answers a grammar refusal by sending the request once
more without enforcement, with the schema written into the system prompt the way DeepSeek is
always given it. The correction pass catches what enforcement would have. The comparison
harness can force this path (`--refuse-enforced-schema`) to measure the notes it writes.

## The kind check

Decided 10 Nov 2026 (OV-275), when OV-216's evidence fields would not fit.

**The recipe block was what filled the grammar.** OV-122 asked, in the one call, whether a
video teaches a recipe, so every video's schema carried the whole nullable `recipe`: summary,
ingredients, steps with their groups and stretches. It was the second-largest part of the schema
after the verdict, and almost every video left it null. Measured with a 16-token reply on Sonnet
5.5 and Opus 5.5, with a reader's context, 30 topics, 20 past claims and 50 tags (1 topic and 300
behaved the same):

| The video schema | Compiles |
|---|---|
| As it was | yes |
| With OV-216's quote positions on key points and what stands out, and its optional line | no |
| … with the topic list as plain strings, or the suggested topic or what stands out made plain | no |
| … with `recipe` taken out | **yes** |
| … and OV-250's steps `{text, range, dubious}` and four more strings | yes |

**So the kind is decided before the note is written.** A small call reads the title, who made
it, the description and the opening of the transcript (`KIND_CHECK_OPENING_WORDS`, 600 words,
counted in code: about four minutes of speech) and answers one `NoteKind`. The note's call then
composes only that kind's sections (`sectionRegistry.ts`):

- **`default`**: today's note, with no recipe block.
- **`recipe`**: In one line as the dish, chapters, filing and the recipe. Nothing argument-shaped,
  which is all a recipe note ever showed (`recipe-notes.md`).

The owner chose this over two others: a flag in the one call followed by a second call for
recipes, which would have doubled a recipe video's cost, and splitting every note into two
calls, which sends every transcript twice and is kept for when even this room runs out.

**One shared core.** Every kind takes its sections from the same list, so key points, the
verdict, filing and the note budget can't drift apart between kinds, which is what OV-87 had
to undo. A kind only adds or leaves out sections.

**A wrong answer degrades, never breaks.** The check answers `default` when unsure, which is a
complete note for any video, and an answer that still breaks its schema after the retry is
taken as `default`. A recipe call that finds no recipe the whole video holds, or none whose
ingredients survive the amount check, falls back to the `default` call. Only a provider failure
fails the overview, as it would have anyway.

**It is generic on purpose.** The owner's direction: kinds beyond recipe can each have a schema
shaped for them (OV-276), such as a `process` kind carrying OV-250's steps block, so a section
only some videos need costs the rest nothing. The check reads a `KindSample` rather than a
video, so articles and podcasts can use it, but articles don't yet: a recipe page is told
apart free and exactly by its own recipe markup, and a check would cost a call and change no
article's note until there is a second kind for them (OV-276).

**It is costed apart.** On our key the check's calls are recorded as `generation` /
`kindCheck` (or `kindCheck-failed`), the note's as `overview` (`unit-economics.md`). The
`capture.newOverview.finished` event carries the `noteKind` the note got, and the API's
"overview made on our key" line the kind the check chose. The comparison harness records the
check's answer and cost on each run and reports its mean cost and the recipe notes made.

**What it costs** is measured in `docs/architecture/cost-model.md`, "The kind check (OV-275)".

## Evidence: the source's own words under a key point

Trello OV-216, built 10 Nov 2026. The reasoning is in `docs/architecture/overview-quality.md`,
"Evidence: the model points, code quotes"; this records what was built.

**The model points, code quotes.** A key point names `quoteStartSegmentIndex` and
`quoteEndSegmentIndex`, the one or two segments inside its own stretch where the claim is said,
and `assembleOverview` lifts those segments from the transcript (`liftQuotation.ts`). No model
writes quotation text, so a quotation can't be invented. What stands out names its quotation
the same way.

- **A quotation that doesn't fit is dropped, never the overview.** One outside its point's own
  stretch, running backwards, or on a point with no stretch leaves that point without evidence.
  The harness counts these (`quotationsInsideTheirLine`) so the rate is measured rather than
  hidden.
- **Code cuts it to 40 words** (`EVIDENCE_MOST_WORDS`), at a whole segment where it can, and
  ends a cut quotation with an ellipsis. A caption's own annotation such as "[Music]" is not
  quoted.
- **Auto-captions are quoted as they are**, unpunctuated and possibly misheard, as the owner
  decided on 10 Nov 2026. Restoring punctuation would mean a model re-emitting the words, which
  is the thing this design rules out. Whether the captions were auto-generated is already on the
  stored transcript (`StoredTranscript.generated`), so the page and the connector label a
  quotation from that rather than the record carrying a copy.
- **Budgeted, not templated.** The prompt allows a quotation on about two points in five
  (`mostQuotations`: one on a three-point note, three on seven, four on ten), for the claims
  that most need the speaker's own words. It is a target the harness checks
  (`quotationsWithinBudget`), not a refinement: a model that over-quotes gets a longer note,
  never a failed one.
- **What the quotation adds is optional and narrow.** `quoteAdds` is null unless the speaker's
  words add something the point does not: a hedge, a contradiction, bluntness, or phrasing that
  makes the claim land. It is never why the subject matters, which the big picture and How to
  apply already say (the owner's gate, 8 Nov 2026). It is nullable rather than an empty string,
  because a required field is an instruction to fill it. Target 20 words, enforced at 30.
- **No speaker is named.** Auto-captions carry no speaker labels, so a quotation says what was
  said, never who said it (OV-226 for when diarisation arrives).

**Where it shows.** Each quotation is a line of its own under the line it backs
(`overviewNoteLines`), never numbered, with its moment as a range tag like a key point's:

- **On the page** its words sit in a `<q>`, so it is marked up as a quotation rather than styled
  as one, with a label above it ("In the video's words", or "From the auto-generated captions"
  when the stored transcript says a machine heard it) and what it adds set under it. The look is
  a placeholder until the Claude Design round.
- **In narration** it is introduced, never announced: "In the video's own words, …", then what
  it adds. A quotation from captions with no punctuation is closed with a full stop so the next
  sentence doesn't run into it. The label is never read.
- **Over MCP** it is a blockquote under its bullet, linked to its moment, with "auto-generated
  captions" beside the link when that is so (read from the transcript's flag alone, never the
  transcript), and what it adds after it in italics. `get_overview` says quotations are there.
- **Analytics**: `capture.newOverview.finished` counts `quotations` and `quotationAsides`, never
  the words, and following a quotation's range is its own `rangeFollowed` line, `quotation`.

**The record.** `KeyPoint.evidence` and `StandsOut.evidence` (`Evidence.ts`: text, range, adds)
are absent rather than null when there is none. Overview schema 17 alters nothing and holds
these records back from clients before version 18, which would strip the evidence on their next
write.

**The grammar.** It fits only because OV-275 took the recipe block out of the video schema
("The kind check"). Probed on 10 Nov 2026 with a 16-token reply: the schema with these fields
compiles on Sonnet 5.5 and Opus 5.5.

## Open, still to decide

- The library-size threshold for personal-claim retrieval and topic-list retrieval to
  need real filtering instead of flat-list stuffing — deliberately left for
  measurement against a real library, not decided now.
