# Note generation decisions, and what produced them

Recorded from a design conversation about the generation step for the real build, in
the same spirit as `docs/decisions.md` and `docs/v1-architecture-decisions.md`: a
decision, stated plainly, with the reasoning that produced it, not a spec.

## The composable prompt

**The prompt becomes a registry of named sections, not one template with
conditionals in it.** Each section carries its prompt text, the JSON schema field(s)
it produces, and whether it's structural or optional. A composer joins whichever
sections are enabled, in a fixed canonical order, into one prompt and one schema per
call.

**Structural vs. optional is a real split, not an arbitrary line.** Video info / In
one line / Core claim / Key points / Topic / Tags are the skeleton — there is no note
and nothing to file without them, so they always run. Verdict, Selling, How to apply
(renamed from Try this — see below), and Watch-it-anyway are the opinionated layer —
exactly the four things README's own "Design principles" section calls out — and are
the four made toggleable, each defaulting on to match current behaviour.

**A toggle removes the field from the request, it doesn't ask the model to skip it.**
Since generation is moving to structured output (`docs/v1-architecture-decisions.md`
already decided this, to fix the markdown-parsing fragility `samples/` exposes),
"toggle off Verdict" has to mean the schema sent to the model has no verdict field
that call — not a prompt instruction the model could ignore. The alternative is a
control that looks off but isn't, which `docs/decisions.md` already rules out for
read/favourite/export ("a control that cannot work is worse than no control" — the
same is true in reverse of one that silently keeps working).

**Verdict's soundness check partly depends on Selling, and that's disclosed, not
hidden.** The prompt already asks Verdict to flag when "the creator is selling
something the advice conveniently requires." Turning Selling off has to turn that
check off too — running it silently in the background after the user turned it off
would be the same lie-about-what-the-toggle-does problem. The Selling toggle's UI
copy should say plainly that switching it off also weakens Verdict's
conflict-of-interest catch.

**This split is the same seam the cost problem in `docs/open-questions.md` #2
needs.** The unresolved hybrid there is "cache the objective analysis once,
personalise only actions/topic per user." Core/Key points is exactly the structural,
non-personal, cacheable half; Verdict/Selling/How-to-apply/Watch-anyway is exactly the
personalised half. Building the registry on that boundary now means the caching work
reuses it later instead of re-deriving it.

## The verdict scale: two axes, one blunt label

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

- Novelty (always shown, one of): `NOVEL` / `COMPETENT, NOT NEW` / `RECYCLED`.
  `COMPETENT, NOT NEW` replaces `SOLID BUT FAMILIAR` — the stated dislike was the old
  phrase specifically, and this reorders the emphasis (quality judgment first,
  familiarity flag second) rather than just re-wording the same two clauses.
- Soundness collapses to one visible bit: `dubious`, present or absent, nothing
  else — see the next section for why a three-value version was considered and
  dropped. This matches the app's own existing badge vocabulary (`sells nothing`,
  `worth watching`): binary, rare, consistent, rather than a graded warning scale.
- `THIN` is not a fourth label. It's a pre-check gate: if Core Claim comes back
  empty/"pure vibes" (which the prompt's existing Core Claim instructions already
  detect), Verdict doesn't run at all and the note says so. This wires an existing
  signal through rather than asking the model to separately remember a THIN verdict.

Re-scored, the five samples become:

| Note | Old label | New label |
|---|---|---|
| business/adaptability | SOLID BUT FAMILIAR | COMPETENT, NOT NEW |
| finance/gap | RECYCLED | RECYCLED |
| fitness/arms | SOLID BUT FAMILIAR | COMPETENT, NOT NEW |
| interesting/heartbeats | NOVEL | NOVEL |
| parenting/multiplication | SOLID BUT FAMILIAR | COMPETENT, NOT NEW |

None of the five cross the `dubious` bar — it's meant to be rare. The overreach
complaints in the business and fitness notes ("no counter-case offered," "the
forearm anecdote... is a joke, not evidence") still show up, just in the reasoning
prose rather than as a badge — see the next section for why that's the right home
for them.

## Soundness collapses to one bit: `dubious`, and why the other two never surface

**The mechanism behind `dubious` matters, and it's weaker than the word implies.**
Nothing in the v1 architecture wires a search or retrieval tool into generation — it's
Claude-only, one shot per video (`docs/v1-architecture-decisions.md`). So "contradicts
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

**Decision: `dubious` doesn't suppress generation, it hides the result.** How to apply
is generated every time regardless of `dubious` — the schema doesn't conditionally
drop the field based on a value computed in the same call. When `dubious` fires, the
UI hides it behind a reveal by default (the same collapsed shape Watch-it-anyway's
yes/no already uses), rather than the note silently contradicting itself by showing
suggested actions right next to a claim it just flagged as dubious. Chosen over not
generating it at all: `dubious` is rare enough that the token cost of always
generating it is small, and it avoids a second on-demand generation round-trip for
the (presumably common) case where the reader does want to see it anyway.

## "Try this" renamed to "How to apply"

**The name assumed one shape of action that doesn't fit every video.** "Try this,"
scoped to "the next 7 days," reads naturally for a habit-change suggestion (its
original use case: parenting, fitness, personal-growth content) but sits oddly against
a recipe, a technique, or a decision framework — content the deferred per-video-type
templates in `docs/v1-architecture-decisions.md` (recipe steps, process instructions)
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

**How the prototype actually produces "novel" vs. "familiar" today: almost entirely
the model's general sense of the genre, not a comparison against anything this
specific user has saved.** `summary-prompt.md` gives the model, per call, only the
video's own URL/title/channel/description and the user's save-time note — no prior
notes, no library, no persisted user memory. The one apparent exception —
parenting/multiplication naming a specific other saved video by ID as making "the
same core claim" — isn't a designed feature. Nothing in the prompt or pipeline asks
for cross-referencing; the only explanation that fits is that both videos landed in
the same batch-processing run and so shared a context window incidentally. A
near-duplicate saved three weeks apart would get no such flag under the current
pipeline.

**Decision: add real personal-library retrieval, gated on the Verdict toggle.**
Before generating Verdict, read the user's own past `claim` fields (already stored
per note, confirmed in `samples/records/*.json`) and pass them into the same call, so
"recycled" can mean "you already saved this," not only "this genre repeats itself."
If Verdict is off, this doesn't run either — no reason to spend the tokens fetching
and injecting past claims for a field that isn't being generated.

**No embeddings, no vector index, for v1.** A personal library's claims are one
sentence each; even a few hundred notes is a few thousand tokens, trivial next to the
~30k-token generation cost already paid per video. Comparing a new claim against a
few hundred known strings is a well-grounded version of the same semantic-similarity
judgment the model already makes against the entire genre from training data — not
the class of unreliable operation `docs/constraints.md` warns about (that rule is
about a model fabricating a count or measurement, not about it making a judgment call
it's actually suited to).

**New structured field: `similar_to: [{ note_id, title }]`, empty when nothing
matches.** The parenting-note cross-reference currently only exists as a sentence
buried in Verdict's reasoning prose — easy to miss. As a structured field, the
library UI can render an actual "You already have a note like this →" chip, turning
an accidental one-off into the "surface the pattern, not just the item" feature
README already wants.

**Left deliberately open: at what library size does a flat claim list stop being
cheap enough to paste into every call, and does topic-scoped filtering become
necessary then.** Not answered by guessing — `docs/constraints.md`'s rule that no
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
  the note's set; dismissing just means the note doesn't gain that topic — it may
  still be filed under others, so declining a suggestion no longer means "stays
  unsorted" the way it did under single-select. Same "degrade visibly" shape as the
  rest of the UI either way: don't silently auto-create a topic, and don't leave the
  user with an unhelped gap either.
- *Pattern-level, from the unsorted pile*: periodically look across just the
  `unsorted` notes' claims for a cluster and propose "N of your unsorted videos look
  like they're about X — create this topic and file them?" This runs against
  already-stored notes as a library-level operation, not inside the generation
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

**Flagged, not solved: renaming or merging topics later touches every note that
includes it.** This has to be a targeted update to the topic reference on existing
note records, not a note regeneration — consistent with the existing lesson in
`docs/decisions.md` that user-facing state should be updatable without the generation
pipeline rewriting the note wholesale. Multi-select doesn't change this, it just means
the update touches a set membership instead of a single field.

**Resolved: Topics and Tags stay separate, on different grounds than either of us
first assumed.** Multi-select made them look structurally identical — both are now
sets of labels on a note — but `prototype/index_template.html` already draws the real
line, and it isn't about structure, it's about interaction: Topics render in the
clickable header meta area, Tags render as plain, non-interactive spans in the
footer (the CSS tokens even group tags with the other non-interactive badges).
**Decision: Topics are the interactive filter — the thing shown and chosen in the
filter area — Tags are not.**

That check also found the prompt's actual stated reason for Tags doesn't hold up.
"3 to 6 lowercase tags for search" implies they add search coverage, but the
prototype's own `haystack()` function already concatenates title, channel, synopsis,
claim, reasoning, try, selling, myNote, points, topic, and verdict — essentially the
whole note — into the searchable text. Checked against all five samples, every tag's
concept already appears as plain text somewhere else in the same note, including the
one that looked like a real counter-example: the parenting note's `mtc` tag is already
spelled out verbatim in its How-to-apply section ("Year 4 Multiplication Tables
Check... MTC age"). Tags add no search recall the rest of the note doesn't already
provide.

**Decision: keep Tags as-is, as a scanning aid, not a search mechanism.** The visible,
non-interactive badges are genuinely useful for quick recognition on their own
merits — that doesn't need "for search" to be true to justify keeping them. Nothing
about the generation prompt or the schema needs to change; what should change is the
prompt's own stated rationale, since it currently describes a job the tags don't
actually do. This also means Tags don't need the consistency/dedup retrieval built
for Topics — a scanning aid tolerates "ai" on one note and "artificial-intelligence"
on another in a way a click-to-filter facet couldn't.

## Selling: one card label, richer data underneath

**Same prose-parsing fragility as Verdict had.** `digest_note.py` derives its `sells`
boolean by checking whether the text starts with the literal string "nothing
detected" — a generation that phrases the none-case any other way ("None found," "No
pitches detected") would silently flip it wrong. Same class of bug
`docs/constraints.md` already names for Verdict's label-parsing, same fix: a
structured field, not a string sniffed from prose.

**The deeper problem: Selling's stated purpose is cross-note pattern-detection, and a
free-text block can't be aggregated.** `docs/decisions.md`: "the value is the pattern
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
  per-note basis, which fits — a single data point in isolation is low-value, the
  pattern across many is the point, and a card is read one at a time.
- **The category still exists, just not as card real estate.** It lives in the
  expanded note (one structured sentence instead of today's paragraph) and in a
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
isn't a new idea — `docs/v1-architecture-decisions.md` already lists "suggested
timestamp ranges for a partial watch-it-anyway" as deferred (Idea 14) — but this
sample is evidence the need shows up today, in the only real Yes in the set, not only as future polish.

**Decided: add `partial` now.** `answer: yes | no | partial`, with an optional
`range: {start_ms, end_ms}` when partial. This is affordable specifically because
transcript source is pinned to Supadata (`docs/v1-architecture-decisions.md`), whose
native mode carries YouTube's own per-segment start/duration timing — the model reads
an offset already present in its input rather than measuring or estimating one
itself, so this doesn't trip the `docs/constraints.md` rule against a model
counting/timing something. Reason text still does the descriptive work ("the
fractal-folding section"), the range just makes that description seekable. Chosen
over waiting for a timestamp-seeking UI to exist first: the range is cheap to capture
now and otherwise old verdicts would need re-generating later just to backfill it.
This doesn't touch the transcript-only blind spot from earlier in this section — the
model still only ever sees caption text at that offset, never the frame — it only
fixes where a real Yes or partial-Yes can point to.

## In one line, Core claim, Key points

**In one line's "roughly how long" clause has been dead instruction from the start.**
The prompt asks for three things — who's talking, roughly how long, and what
territory it covers — and zero of five samples state a duration, not even
approximately. That's not the model skipping the instruction; `docs/open-questions.md`
#3 already established the prototype's transcript source exposed no duration at all,
so there was never a real number to report, and `docs/constraints.md`'s rule against
fabricating a measurement means the model correctly never guessed one instead. This is
the third thing the Supadata pin fixes for free, alongside video runtime and
Watch-it-anyway's range: once real segment timing exists, this clause finally has
something to point at.

**Decided: the creator's name lives only in `Channel`, never repeated in `In one
line`.** The samples were inconsistent — "Ryan Humiston," "Veritasium" named outright,
but "a finance YouTuber," "a presenter" elsewhere — even though there's already a
dedicated field for it. One place, consistently, rather than per-note judgment calls.

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
skip this." For an MIT lecture correctly teaching standard material, `competent_not_new`
is accurate but isn't a reason to skip anything — the value of the lecture is in the
teaching, not the novelty of the theorem. **Left as an interpretive fix, not a
structural one, for now:** the reasoning text already carries this distinction (as
it already does for the overreach cases folded into prose elsewhere in this doc),
and the topic a note is filed under does real disambiguating work for free — a
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

## Open, still to decide

- The library-size threshold for personal-claim retrieval and topic-list retrieval to
  need real filtering instead of flat-list stuffing — deliberately left for
  measurement against a real library, not decided now.
