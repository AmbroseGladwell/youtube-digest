# Open questions

Each has evidence attached, because several of these look like small decisions and are not.

The order was by how much each matters, and the numbers are now fixed, because other docs cite
them (`cost-model.md` opens on #2). New questions are appended rather than slotted in. **#6, added
7 Nov 2026, outranks every other question here:** it is about what an overview is for, and the
answer moves #1 and #4 with it.

## 1. The verdict scale does not discriminate

Across 30 real notes:

| Verdict | Count |
|---|---|
| SOLID BUT FAMILIAR | 23 |
| RECYCLED | 5 |
| NOVEL | 2 |
| THIN | 0 |
| DUBIOUS | 0 |

One bucket holds 77% of the library and two buckets have never been used. A scale that sorts almost everything into the same pile is not doing work, whatever the labels are called.

The user's stated dislike is specifically the phrase "SOLID BUT FAMILIAR", but renaming the middle option does not fix the distribution. The question to answer before redesigning: what distinction does a reader actually act on? Plausibly there are two independent axes rather than one scale, something like *is the claim sound* and *did I already know this*, which would make today's single scale a lossy projection of both. Do not redesign this from first principles without looking at the real notes in `samples/`.

Related and separate: the verdict label is currently read aloud before the verdict text during playback, which the user finds redundant. That is a one-line change wherever the spoken script is assembled.

## 2. The cost model does not scale the way the product needs

Generating a personalised note costs roughly 30,000 tokens per video. Because notes are written against the individual reader's context, two people saving the same video pay twice. Cost therefore scales with users times videos, unlike a summarise-once-distribute-to-many product.

Dropping personalisation would allow a shared cached summary per video and change the economics entirely, at the cost of the thing that makes "Try this" worth reading. This is the central product tension and it is unresolved.

**Decided on 19 Oct 2026 (OV-19): the hybrid, measured, in `docs/architecture/cost-model.md`.** A personal note cost about 8,400 prompt tokens on GPT-6.1 Sol, not 30,000, and a personal pass from a shared note cost an eighth of a single pass. What follows is the question as it was first put.

Worth noting: a hybrid is possible and untested. The expensive part is understanding the video, which is not personal. The personal part is only the actions and the topic assignment. A cached objective analysis plus a cheap per-user personalisation pass might get most of the value at a fraction of the cost.

## 3. Video runtime

The user wants to see the time saved: "3 min listen, ~13 min video". Investigated and abandoned, because the transcript source exposes no duration and its timestamps are client-side only. The two remaining routes are a word-count estimate, which cannot honestly carry second-level precision, or finding a transcript source that exposes timings server-side, which would make it exact.

Whatever route is taken, existing notes cannot be backfilled without re-fetching every transcript.

## 4. Whether the verdict is trusted, and whether the actions get done

The prototype answered its own first question, which was whether reading a summary satisfies the urge to watch. It appears to: the user reports less time spent watching videos to learn from, and learnings that are easier to bring into a conversation and act on.

Two harder questions are untested. A verdict is only useful if the reader believes it enough to skip something on its say-so. And generating a good suggested action is easy to verify, whereas whether it changes behaviour is not. Both need instrumentation that the prototype does not have.

## 5. Speech

Designed and measured, not built. See `tts-pre-rendered-speech.md`. The open choices are which voice, which audio format, whether to backfill existing notes at roughly 90 seconds of CPU each, and where the audio lives. Everything else about it is settled and proven on one real note.

## 6. Is an overview triage, or is it comprehension?

**Answered by the owner on 7 Nov 2026: comprehension, with the triage kept inside it.** The
reasoning is that the product is becoming a knowledge and context layer, and a triage note is
not enough context to be worth carrying into a conversation six months later. The verdict is
not dropped and is not demoted: it stays part of every overview, and
`docs/architecture/product-direction.md` argues it is worth more in a context layer than it
ever was in a reader.

What that settles, and what it does not:

- **It settles the budget argument.** When a long source makes coverage and brevity compete,
  coverage wins. OV-87 and OV-203 are raising their key-point ceilings in the right direction,
  and `coreSection.ts`'s "seven is the ceiling however long the video is" was a cost decision
  that has now been overtaken. Change it deliberately and record why.
- **It ungates OV-216**, the evidence and quotations card, which was waiting on this answer.
- **It does not license length for its own sake.** `README.md`'s measure of success is still
  time not spent on the original, and OV-87's open question about tone at length is still
  open: a long note that reads clipped is a worse note, not a more complete one.
- **It does not settle #4**, which is still the untested one underneath: whether a reader
  believes a verdict enough to skip something on its say-so. Comprehension being the product
  makes that question more important, not less, because the verdict now has two jobs.

The question as it was first put follows.

Added 7 Nov 2026, from two outside conversations the owner brought in
(`docs/reference/chatgpt-overview-quality-and-context.md`,
`docs/reference/gemini-longform-podcast-pipeline.md`). The comparison, the costs and what
would change are in `docs/architecture/overview-quality.md`. This is the question itself.

`README.md` says the product is **triage**: "most saved content is not worth your time, and
you can't tell which until after you've spent it", the output "is deliberately not a summary
... this produces a judgment", watch it anyway defaults to No, and the verdict distribution
across a real library should be unflattering.

The alternative is **comprehension**: a reader who has not consumed the original can
accurately explain its important ideas and tell the source's claims apart from the evidence
for them. Its first principle is the opposite of the triage one: don't miss important
substance just to make something shorter.

A two-hour podcast that repackages standard advice gets a blunt verdict and a short note
under the first, and a six-to-ten-minute deep brief under the second.

**The evidence that this is live, rather than philosophical:** the build has been drifting
towards comprehension for a month, one good local decision at a time, without anyone saying
so. OV-87 raises the key-point ceiling for long videos, against `coreSection.ts`'s explicit
"seven is the ceiling however long the video is". OV-203 asks for more key points on a dense
short article. OV-202 measures how much of a source a note covers. Articles already have
`paragraphsInTheFinalStretch` and `chaptersTooBigToSkip`, both of which exist so a note does
not miss parts of its source. None of those was wrong. None of them asked whether the
ceiling was a cost decision or a product one.

**What would settle it:** not an argument. #4 is the untested question underneath, and it is
still untested: whether a reader believes a verdict enough to skip something on its say-so.
If they do, triage is the product and length is a cost to be minimised. If they read the
note instead of the source and want more of it, comprehension is the product and the verdict
is a header on it.

A third answer is available and should be considered before the other two: that the verdict
is the triage layer and the key points are the comprehension layer, they already coexist,
and the real question is only which one gets the budget when a long source makes them
compete.
