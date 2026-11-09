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
| Neon | prod | database | cost entered by hand: the plan's fee, $0 on the free plan. Usage from the project API: compute and active hours and transfer this month so far, and storage now |
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

**Neon on the free plan gives usage, not a bill.** Its consumption API, which reports by
day, answers 403 below the Launch plan (checked 9 Nov 2026). The project itself reports this
billing period's totals so far on every plan: `compute_time_seconds`,
`active_time_seconds` and `data_transfer_bytes`, and each branch its `logical_size`. So
each night records them, as of the run, on yesterday's file as `usage` rows:
`compute_hours_month_to_date`, `active_hours_month_to_date`, `transfer_gb_month_to_date`
and `storage_gb`. They cannot be split into days or backfilled, so a backfill that does not
end yesterday reads nothing from Neon. Read the latest day for the month so far, against the
free plan's allowances. The cost row stays the plan's fee entered by hand; on a paid plan,
the consumption API and its daily figures replace both.

## The rows

One CSV per UTC day, at `daily/YYYY-MM-DD.csv` in the `the-overview-spend` bucket, in Western
Europe with no jurisdiction: PostHog's R2 source refuses an EU-jurisdiction bucket's
`<account>.eu.r2.cloudflarestorage.com` address (9 Nov 2026):

| Column | Is |
|---|---|
| `date` | the UTC day the cost was incurred |
| `provider` | `openai`, `neon`, … |
| `environment` | `prod`, `dev`, `evals`, or `unattributed` |
| `area` | `generation`, `embeddings`, `database`, `servers`, `narration`, `transcripts`, `storage` |
| `dollars` | to six places, **blank when not tracked**, never zero for a figure nobody read |
| `source` | `bill`, `manual`, `not_tracked`, or `usage` for a row that measures use rather than money |
| `reason` | why a row is not tracked: a missing key, the status a provider answered, the bill having no figure for the day yet, or not built yet |
| `quantity`, `unit` | on a `usage` row, how much and of what (`compute_hours_month_to_date`); blank on rows of money |
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
with **Object Read only** on this bucket, separate from the job's read and write token, so
PostHog holding a key can never change or delete the history it reads.

**What it costs.** About 17 rows a day, so about 500 synced rows a month against the
warehouse's 1M free; a few KB a day in R2, against its 10 GB and its free operations. The
OpenAI Costs API is free, and Actions minutes are free on a public repository. Checked on
9 Nov 2026.

## Running it

`.github/workflows/spend.yml` runs at 04:30 UTC every night, and by hand from the Actions
tab with an optional `from` and `to` to record or backfill a range of up to 180 days.

| It reads | Kind | Where |
|---|---|---|
| `OPENAI_ADMIN_KEY` | Actions secret | an OpenAI **admin** key, read-only, made under the organisation's admin keys; also kept in `overview-prod` |
| `NEON_API_KEY` | Actions secret | a Neon API key scoped to the one project; also kept in `overview-prod`. The project's id is in the workflow, since it is not a secret |
| `SPEND_R2_ACCESS_KEY_ID`, `SPEND_R2_SECRET_ACCESS_KEY` | Actions secrets | an R2 token with Object Read & Write on `the-overview-spend` only; also kept in `overview-prod` |
| `SPEND_MANUAL_ENTRIES` | Actions variable | the hand-entered figures above |

A missing OpenAI key leaves OpenAI not tracked and warns; a missing R2 key fails the run,
since nothing can be recorded.

The code is `scripts/spend/`: one module per provider, the expected rows, the CSV, the R2
store, and `recordSpend.mjs`, which puts them together. Each provider's adapter is tested
on its response shape with no live call (`npm run test:tooling`).
