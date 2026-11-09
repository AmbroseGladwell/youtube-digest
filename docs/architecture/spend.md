# Spend: what the project costs to run, by environment and by area

One place to see what is spent, in production, in development and on evals (OV-257). A
nightly job reads each provider's own bill, writes one CSV per day to a private R2 bucket,
and PostHog's warehouse reads the bucket, so the dashboard is a PostHog dashboard and there
is no admin page to build. What each reader costs is the next card, OV-259, built on these
rows.

## Where each figure comes from

**The provider's bill is the source of truth for money.** A figure is read from the
provider's own API, entered by hand and marked so, or shown as not tracked. Nothing is
estimated, and no model works anything out (`docs/prototype/constraints.md`).

| Provider | Environment | Area | Source today |
|---|---|---|---|
| OpenAI | prod, dev, evals | generation, embeddings | the Costs API with an admin key, grouped by project and line item |
| Neon | prod | database | entered by hand: the free plan, $0. Its consumption API answers 403 on the free plan |
| Anthropic | evals | generation | not tracked yet |
| Gemini | evals | generation | not tracked yet |
| Decodo | prod | transcripts | not tracked yet |
| Fly.io | prod | servers (the API app), narration (the TTS app) | not tracked yet |
| Cloudflare | prod, dev | storage | not tracked yet |

The environments are the ones `docs/conventions/secrets.md` splits every key by: no paid
key is shared between `overview-prod`, `overview-dev` and `overview-evals`, so each bill
splits on the provider's own grouping. Anthropic, Gemini, Decodo and Neon are used by one
environment each, so their whole bill is that environment's.

**OpenAI's environment is the project's name.** OV-256 made one project each, `prod`, `dev`
and `evals`; a project whose name ends or starts with one of those words is that environment.
Cost on any other project, or on none, is recorded as `unattributed` rather than dropped,
so a key made outside the three shows up on the dashboard instead of disappearing.

**OpenAI's area is the line item.** A line item naming an embedding model is `embeddings`,
everything else is `generation`. So prod's bill splits into the two without the app
recording anything.

## The rows

One CSV per UTC day, at `daily/YYYY-MM-DD.csv` in the `the-overview-spend` bucket:

| Column | Is |
|---|---|
| `date` | the UTC day the cost was incurred |
| `provider` | `openai`, `neon`, … |
| `environment` | `prod`, `dev`, `evals`, or `unattributed` |
| `area` | `generation`, `embeddings`, `database`, `servers`, `narration`, `transcripts`, `storage` |
| `dollars` | to six places, **blank when not tracked**, never zero for a figure nobody read |
| `source` | `bill`, `manual` or `not_tracked` |
| `reason` | why a row is not tracked: a missing key, the status a provider answered, the bill having no figure for the day yet, or not built yet |
| `recorded_at` | when the job wrote it |

**Every expected provider × environment × area has a row every day** (`expectedSpend.mjs`).
A provider the job read but which spent nothing that day is `0` from the bill; one it could
not read is `not_tracked` with the reason. So a gap on the dashboard is always a labelled
gap, and "not tracked" can never be mistaken for "free" (`CLAUDE.md`, "Degrade visibly").

**A rerun replaces a day.** Each day is one object, written whole, so recording a day
again overwrites it rather than adding to it. The nightly run records the last three whole
UTC days, so a bill that settles late is picked up on the next two nights.

**A day counts as recorded only once it reads back** byte for byte from R2 (`CLAUDE.md`,
"Verify before reporting"). A failed write or a mismatch fails the run; a provider that
could not be read warns on the run and leaves its rows not tracked.

## Figures entered by hand

Some costs have no API, or none on the plan we are on. They are entered as a monthly
figure in the repository variable `SPEND_MANUAL_ENTRIES`, a JSON list:

```json
[{ "provider": "neon", "environment": "prod", "area": "database", "monthlyDollars": 0, "from": "2026-09-27" }]
```

`to` is optional and closes an entry, for a price change. A monthly figure is spread evenly
over its month's days, so a day's total and a month's total both come out right, and every
such row is `manual`. A hand-entered figure never replaces a bill: if both exist, the bill
is kept and the run warns. A variable that does not parse warns, and every hand-entered
figure shows as not tracked until it is fixed.

It is a variable, not a committed file, **because the repository is public**: a figure in
it would publish the bill. For the same reason the job's log names each provider's source
and how many rows were written, never an amount.

## Why not analytics events

The card first suggested a `spend_recorded` event. An analytics event is something a
reader did in the app, and nothing else (`analytics.md`, "Actions, not logs"); spend is
neither. A day's file also gives a rerun its replace-not-add behaviour for free, where
events would need deduplicating, and CI holds a key to one bucket rather than a credential
for the production database.

## PostHog

The bucket is linked as a **Cloudflare R2 source** in PostHog's data warehouse, with
"Combine every file into one table" on and an incremental sync, which reads only new and
changed files and replaces a changed file's rows. The read key PostHog holds is an R2 token
with **Object Read only** on this bucket.

**What it costs.** About 13 rows a day, so about 400 synced rows a month against the
warehouse's 1M free; a few KB a day in R2, against its 10 GB and its free operations. The
OpenAI Costs API is free, and Actions minutes are free on a public repository. Checked on
9 Nov 2026.

## Running it

`.github/workflows/spend.yml` runs at 04:30 UTC every night, and by hand from the Actions
tab with an optional `from` and `to` to record or backfill a range of up to 180 days.

| It reads | Kind | Where |
|---|---|---|
| `OPENAI_ADMIN_KEY` | Actions secret | an OpenAI **admin** key, read-only, made under the organisation's admin keys; also kept in `overview-prod` |
| `SPEND_R2_ACCESS_KEY_ID`, `SPEND_R2_SECRET_ACCESS_KEY` | Actions secrets | an R2 token with Object Read & Write on `the-overview-spend` only; also kept in `overview-prod` |
| `SPEND_MANUAL_ENTRIES` | Actions variable | the hand-entered figures above |

A missing OpenAI key leaves OpenAI not tracked and warns; a missing R2 key fails the run,
since nothing can be recorded.

The code is `scripts/spend/`: one module per provider, the expected rows, the CSV, the R2
store, and `recordSpend.mjs`, which puts them together. Each provider's adapter is tested
on its response shape with no live call (`npm run test:tooling`).
