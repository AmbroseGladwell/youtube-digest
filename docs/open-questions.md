# Open questions

Ordered by how much they matter. Each has evidence attached, because several of these look like small decisions and are not.

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

Worth noting: a hybrid is possible and untested. The expensive part is understanding the video, which is not personal. The personal part is only the actions and the topic assignment. A cached objective analysis plus a cheap per-user personalisation pass might get most of the value at a fraction of the cost.

## 3. Video runtime

The user wants to see the time saved: "3 min listen, ~13 min video". Investigated and abandoned, because the transcript source exposes no duration and its timestamps are client-side only. The two remaining routes are a word-count estimate, which cannot honestly carry second-level precision, or finding a transcript source that exposes timings server-side, which would make it exact.

Whatever route is taken, existing notes cannot be backfilled without re-fetching every transcript.

## 4. Whether the verdict is trusted, and whether the actions get done

The prototype answered its own first question, which was whether reading a summary satisfies the urge to watch. It appears to: the user reports less time spent watching videos to learn from, and learnings that are easier to bring into a conversation and act on.

Two harder questions are untested. A verdict is only useful if the reader believes it enough to skip something on its say-so. And generating a good suggested action is easy to verify, whereas whether it changes behaviour is not. Both need instrumentation that the prototype does not have.

## 5. Speech

Designed and measured, not built. See `tts-pre-rendered-speech.md`. The open choices are which voice, which audio format, whether to backfill existing notes at roughly 90 seconds of CPU each, and where the audio lives. Everything else about it is settled and proven on one real note.
