# Connections between ideas

OV-218, measured with OV-217 (`similarTo`) and OV-350 (library questions), 22–23 Nov 2026. Nothing
here is built yet. This is the measurement, and what it decided.

**The decision:** there is no list of connections on an overview. A connection between two
overviews is worth showing only when it tells the reader something they wouldn't already think,
and no model could tell those apart from the obvious ones. The connections instead feed the
questions suggested in library and project chat (OV-350), where the owner was glad to ask 12 of 15.

## How it was measured

`apps/api/src/scripts/connectionsCheck.ts`, on the owner's library exported read only from
production (about 220 overviews, 1,550 claims, the profile and 4 projects). Precision before
recall, as the card asked. A model labels; a model from another vendor judges blind; the owner
reviews a sample on a local page, because the judge is a model too.

**Candidates are found by code**, from the claim embeddings OV-229 already stores
(`search-by-meaning.md`): each overview's three closest partners by the best pair of claims,
`similarTo` links from generation, and, in a second round, each overview's two closest partners
sharing no topic. Luna (`gpt-6-luna`) labels a pair's relation and whether it's a real connection;
Claude Sonnet 5.5 judges.

### Round 1: is there a connection? (120 pairs)

| | Kept | Judged real |
|---|---|---|
| Luna, first rubric, embedding pairs | 68 of 80 | 50% |
| Luna, strict rubric, embedding pairs | 51 of 80 | 61% |
| Luna, strict rubric, `similarTo` links | 51 of 56 | 86% |
| Strict rubric, all | 87 | 69%, keeping 95% of the judge's real ones |

- **A strict rubric helps and costs nothing**: "sharing a subject is not a connection", never say
  one note extends another unless it says so, name the idea not the subject.
- **`similarTo` is the best source of connections, not a sameness signal** (OV-217's question):
  80–89% real across both rounds, and only 1 of 56 judged the same claim.

### Round 2: different views, surprise, and the reader (110 pairs)

- **A "different view" relation** (same question, different answer) works: the judge chose it 11
  times and called 10 real.
- **Cross-topic candidates** were judged real 5 times in 23, mostly stretches.
- **A "for you" line** drawn from the profile and projects was grounded and tentative 86% of the
  time, and with nothing known about the reader it said nothing 20 times in 20. It was written on
  97% of links, which turned out to be the problem.

### The owner's review: real is not the bar (20 pairs)

The owner called 12 of 20 real. The judge never called real what the owner rejected (8 of 8), but
missed 4 the owner called real, so the judge is conservative. The notes said the real problem:
**a true but obvious link is pointless to show** (two overviews both saying an AI tool speeds up
delivery). A reason has to bring the two together into something neither says alone.

### Round 3: can a model write and choose the insight? (93 pairs)

| Writer | Wrote an insight | Owner glad | Owner: obvious |
|---|---|---|---|
| Claude Sonnet 5.5 | 86% of pairs | 4 of 11 | 7 |
| Claude Opus 5.5 | 87% of pairs | 2 of 13 | 11 |

Asked to decline when there was nothing worth saying, both wrote an insight for every pair the
owner had rejected. A separate blind "worth showing" check didn't match the owner either:

| Check | Agreed with the owner, of 24 |
|---|---|
| Sonnet | 8 (kept 2 of 6 glad, 12 of 18 obvious) |
| Luna | 8 |
| Haiku | 15, only by rejecting nearly everything (0 of 6 glad) |

Whether a link is obvious depends on what the reader already knows, which neither note shows.

### Round 4: questions instead (15 questions, two runs)

The same connections, turned into questions for library and project chat. Code picks pairs (for a
project, pairs among its own overviews), Luna labels them, and one Sonnet call writes up to six
questions, skipping pairs whose only question is obvious.

- **First run:** median 28 words, 9 of 15 two sentences. Too long.
- **At overview questions' length** (`FOLLOW_UP_QUESTION_TARGET_WORDS`, `_MAX_WORDS`): 15–21
  words, one sentence. **The owner was glad to ask 12 of 15**: every project question (8 of 8) and
  4 of 7 for the library.
- Of the three obvious ones, two had dropped the second overview, and one was a well-known
  dilemma. So a question has to draw on both overviews, and no theme repeats while on show.

The build is OV-350, which records the decisions.

## Cost

Measured, at the list prices in `modelPrices.ts`:

| | Per call |
|---|---|
| Luna labelling a pair | $0.00036 |
| Sonnet writing an insight for one pair | $0.0068 |
| Opus writing an insight for one pair | $0.020 |
| A question refresh: about 16 pairs labelled, one Sonnet call for up to 6 questions | **$0.016** |

The first, long questions cost $0.029 a refresh: Sonnet's output was 1,300–1,900 tokens, against
about 250 for the short ones.

**Why not a connection on every save:** about 6–7 candidate pairs per new overview, so about
$0.034 an overview with Sonnet writing, roughly doubling an overview's own cost
(`cost-model.md`), and about $93 to fill in a library of 5,000. Questions written only when shown
cost about $0.21 per paid reader a month at three refreshes a week, and nothing to fill in an
existing library, whatever its size.

## Running it again

From the repo root, with the export from `docs/architecture/in-app-chat.md` ("Running it again";
it now also exports the settings row) in `<data dir>/library` and `<data dir>/profile`:

```
node apps/api/dist/scripts/connectionsCheck.js candidates <data dir>
task secrets:evals -- node apps/api/dist/scripts/connectionsCheck.js run <data dir> --limit 120 --budget 2
node apps/api/dist/scripts/connectionsCheck.js report <data dir>
node apps/api/dist/scripts/connectionsCheck.js candidates2 <data dir>
task secrets:evals -- node apps/api/dist/scripts/connectionsCheck.js run2 <data dir> --budget 2
node apps/api/dist/scripts/connectionsCheck.js report2 <data dir>
node apps/api/dist/scripts/connectionsCheck.js review-page <data dir>
task secrets:evals -- node apps/api/dist/scripts/connectionsCheck.js run3 <data dir> --budget 2.5
node apps/api/dist/scripts/connectionsCheck.js review-page3 <data dir>
task secrets:evals -- node apps/api/dist/scripts/connectionsCheck.js gate <data dir> --budget 0.5
task secrets:evals -- node apps/api/dist/scripts/connectionsCheck.js questions <data dir> --budget 0.75
task secrets:evals -- node apps/api/dist/scripts/connectionsCheck.js questions-short <data dir> --budget 0.3
node apps/api/dist/scripts/connectionsCheck.js questions-short-page <data dir>
```

- Every paid command resumes from its results file and stops at `--budget`.
- The review pages are local files with the reader's titles in them. They are never committed or
  published. The owner's answers are saved beside them (`owner-answers*.json`), and `gate` and
  `questions` read them.
- Keep the data dir under `packages/model-comparison/.local/`, which is ignored.
