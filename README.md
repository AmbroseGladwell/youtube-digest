# Video Digest

Turns the short-form videos you save and never watch into structured notes you can read in ninety seconds, listen to on a commute, and actually act on.

## The problem

Saving a video feels like learning something. It isn't. The saved list grows, the videos stay unwatched, and the few you do watch turn out to be eight minutes of hook and story wrapped around thirty seconds of substance. Meanwhile the thing you genuinely wanted, the one idea worth trying this week, never makes it out of the app and into your actual life.

Existing read-later tools treat this as a storage problem. It isn't a storage problem. It's a triage problem: most saved content is not worth your time, and you can't tell which until after you've spent it.

## What it does

1. You save a video the way you already do, from the share sheet on your phone.
2. It fetches the transcript and writes a structured note: what the video actually claims, the substance with the padding stripped out, a blunt verdict on whether it was worth anything, and one to three things you could do about it in the next week.
3. Notes are filed by topic and land in a library you can search, filter, read, or have read aloud to you with the text highlighting as it goes.

The output is deliberately not a summary. A summary is shorter content. This produces a judgment.

## The note format

Every note has the same shape, which is what makes a hundred of them scannable:

| Section | Purpose |
|---|---|
| In one line | What the video *is*, so you can recognise it later. Format, length, territory. Not what it argues. |
| Core claim | The single assertion. If it asserts nothing and is pure vibes, it says so. |
| Key points | Three to five bullets, substance only. Hook, story, restatement and call to action removed. |
| Verdict | One of five ratings, plus blunt reasoning. |
| Selling | Anything the creator is pitching: a course, a supplement, an affiliate link, their own app. Recorded even when it doesn't change the verdict, because the pattern across many notes is the signal. |
| Try this | One to three concrete actions for the next seven days, or an honest "nothing actionable". |
| Watch it anyway? | Yes or no, defaulting to no. |

## Verdicts

`NOVEL` · `SOLID BUT FAMILIAR` · `RECYCLED` · `THIN` · `DUBIOUS`

The scale exists to be unflattering. Most short-form content is a repackaging of standard advice, and saying so plainly is the most useful thing the tool can tell you. Contradicting mainstream evidence, or advice that conveniently requires something the creator sells, gets flagged.

## Design principles

These are the opinionated calls. They are what makes it useful rather than another summariser.

**Default to not watching.** The "watch it anyway?" answer defaults to no. Yes is reserved for cases where the visual *is* the claim: a physical technique you would perform wrong from a written description, a demonstration whose outcome is the evidence. It is not enough that seeing it would be nicer. Every soft yes costs the reader ten minutes they will not get back.

**Be blunt.** A tool that tells you everything you saved was insightful is worthless. The verdict distribution across a real library should be unflattering, and if it isn't, the tool is broken.

**Surface the pattern, not just the item.** Counting how often you save the same claim, and how often the advice comes attached to something being sold, tells you more about your own saving habits than any individual note does.

**Reading and listening are the same content.** The note is generated once and rendered both ways, with the spoken version highlighting sentence by sentence so you can follow along. Listening while doing something else is the realistic use case, not a bonus feature.

**Actions expire.** "Try this" is scoped to the next seven days and phrased concretely. Not "prioritise connection" but a specific thing, on a specific evening, with a specific person.

## Open questions

The question the first version exists to answer: **does reading the summary actually satisfy the urge, or do you still feel the pull to watch the video?** If it's the latter, the premise is wrong and no amount of polish fixes it.

Secondary, and unresolved:

- **Cost scales with users times videos.** Unlike a summarise-once-distribute-to-many product, personalised notes have to be generated per person even when two people save the same video. Dropping personalisation would allow caching a shared summary per video, at the cost of the thing that makes "Try this" worth reading. This is the central product tension and it is not yet resolved.
- **Does the verdict get trusted?** A rating is only useful if the reader believes it enough to skip things on its say-so.
- **Do the actions get done?** Generating a good suggestion is easy to verify. Whether it changes behaviour is not.

## Known constraints

- **Captions only.** Notes are generated from the transcript. No captions, no note. Audio transcription would widen coverage considerably and is the obvious next capability.
- **YouTube first.** Instagram, TikTok and Facebook are where a lot of this content actually lives, and they are harder to reach.
- **Transcript retrieval is the fragile link.** It fails intermittently on videos that do have captions, so retries and a queue that survives partial failure are not optional.
- **The pipeline must be resumable.** Any run can be interrupted. Each video is processed and committed completely before the next one starts, so an interrupted run leaves finished work saved and unfinished work untouched, rather than a half-written batch.

## Status

Prototype in daily use by one person. The capture path, transcript retrieval, note generation, topic filing and the reading and listening library all work. The measurable early result is less time spent watching videos to learn from them, and learnings that are easier to bring into a conversation and turn into action.
