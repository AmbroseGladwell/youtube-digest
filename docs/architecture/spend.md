# Spend: what the project costs to run, by environment and by area

One place to see what is spent, in production, in development and on evals (OV-257). A
nightly job reads each provider's own bill, writes one CSV per day to a private R2 bucket,
and PostHog's warehouse reads the bucket, so the dashboard is a PostHog dashboard and there
is no admin page to build. What each reader costs, and prod split further than the bill
splits it, is the next card, OV-259, built on these rows ("What this does not do").

## Where each figure comes from

**The provider's bill is the source of truth for money.** A figure is read from the
provider's own API, entered by hand and marked so, or shown as not tracked. Nothing is
estimated, and no model works anything out (`docs/prototype/constraints.md`).

| Provider | Environment | Area | Source today |
|---|---|---|---|
| OpenAI | prod, dev, evals | generation, embeddings | the Costs API with an admin key, grouped by project and line item |
| Neon | prod | database | cost entered by hand: the plan's fee, $0 on the free plan. Usage from the project API: compute and active hours and transfer this month so far, and storage now |
| Anthropic | evals | generation | entered by hand: an individual account has no Admin API, so no cost report |
| Gemini | evals | generation | entered by hand: Gemini's cost needs a Google Cloud billing export to BigQuery |
| Decodo | prod | transcripts | cost entered by hand: the plan's fee. Usage from the traffic statistics API: proxy traffic in GB and requests, each day |
| Fly.io | prod | servers (the API app), narration (the TTS app) | entered by hand: Fly.io has no cost API |
| Cloudflare | unsplit (cost), prod and dev (usage) | storage, and any other service under its own name | cost from the billable usage API (alpha, FOCUS); usage from R2's analytics: storage in GB and requests per bucket, each day |

A provider entered by hand shows as not tracked, with a reason saying what to enter, until
its figure is in `SPEND_MANUAL_ENTRIES` ("Figures entered by hand").

**Decodo** reports traffic, never money, at `POST /api/v2/statistics/traffic` with the key in
`Authorization` as it is. The plan, from its subscriptions endpoint, was a year's 1 GB of
residential traffic from 5 Oct 2026, so its cost is the plan's fee entered by hand, a
twelfth of it each month. A day with no traffic records 0, not nothing.

**Cloudflare's bill is one account for every environment**, so its cost is `unsplit`, as
OpenAI's is before 9 Nov 2026. R2's charges are `storage`; any other service on the bill gets
its own area from its service family rather than being dropped. The usage rows split by
bucket: a bucket whose name ends in `-dev` is dev, every other bucket prod. Two things found
live on 9 Nov 2026: the billable usage endpoint returns only the current billing period
(it started on the 30th) and its date filters return nothing, so it is read whole and
matched by day; and R2's analytics refuse a range wider than 32 days, so they are read 31
days at a time. Days before the current billing period cannot be read, so the job keeps
whatever was recorded for them ("Keeping what a reader cannot read again"); the backfill
from 27 Sep 2026 left 27 Sep to 29 Oct not tracked.

The environments are the ones `docs/conventions/secrets.md` splits every key by: no paid
key is shared between `overview-prod`, `overview-dev` and `overview-evals`, so each bill
splits on the provider's own grouping. Anthropic, Gemini, Decodo and Neon are used by one
environment each, so their whole bill is that environment's.

**OpenAI's environment is the project's name.** The projects are "The Overview Prod", "The
Overview Dev" and "The Overview Evals": a name that ends or starts with `prod` (or
`production`), `dev` or `evals` is that environment. Cost on any other project, or on none,
is recorded as `unattributed` rather than dropped, so a key made outside the three shows up
on the dashboard instead of disappearing. The first live run, on 9 Nov 2026, found all of
it unattributed because the production project was still called "The Overview".

**Before 9 Nov 2026 OpenAI's spend is `unsplit`.** Until OV-256, the production project was
the only one, and dev, evals and prod all spent on it. Its spend before that day is recorded
as `unsplit`, and prod, dev and evals as not tracked with a reason pointing there, rather
than as prod's or as zero.

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
| `environment` | `prod`, `dev`, `evals`, `unattributed`, or `unsplit` for one bill covering every environment: OpenAI before 9 Nov 2026, and Cloudflare |
| `area` | `generation`, `embeddings`, `database`, `servers`, `narration`, `transcripts`, `storage` |
| `dollars` | to six places, **blank when not tracked**, never zero for a figure nobody read |
| `source` | `bill`, `manual`, `waived` for a cost the provider let off, `not_tracked`, or `usage` for a row that measures use rather than money |
| `reason` | why a cost was waived, or why a row is not tracked: a missing key, the status a provider answered, the bill having no figure for the day yet, a day outside what the provider can report, or what to enter by hand |
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
could not be read warns on the run.

### Keeping what a reader cannot read again

Rewriting three days every night would otherwise lose figures a provider can no longer
report: Cloudflare's bill only covers the current billing period, Neon only knows the month
so far as of the latest run, and an outage would blank two days already recorded. So before
a day is rewritten, the job reads the stored day, and for every provider that cannot read
that day (a reader says which days it can read, and a failed or missing provider can read
none) it keeps that provider's stored `bill` and `usage` rows. Stored `manual` and
`not_tracked` rows are never kept, so today's hand-entered figures and reasons always win.
With nothing stored, the provider is not tracked with its reason, as before. The run's log
names the providers it kept figures for.

## Figures entered by hand

Some costs have no API, or none on the plan we are on. They are entered as a monthly
figure in the repository variable `SPEND_MANUAL_ENTRIES`, a JSON list:

```json
[{ "provider": "neon", "environment": "prod", "area": "database", "monthlyDollars": 0, "from": "2026-09-27" }]
```

`to` is optional and closes an entry, for a price change. A monthly figure is spread evenly
over its month's days, so a day's total and a month's total both come out right, and every
such row is `manual`.

**A cost the provider let off is still entered, with `waived` saying why**, for example
`"waived": "under Fly's $5 monthly minimum"`. Its rows are `waived`, carrying the reason. Spend
totals leave them out, since nothing was paid, but unit economics counts them
(`unit-economics.md`): a waiver ends as soon as use grows, which is when cost per account
matters. A waived month is whole or nothing (Fly bills every dollar once a month passes $5),
so the figure entered is the usage cost the provider shows, not the part above the minimum. A hand-entered figure never replaces a bill: if both exist, the bill
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

The bucket is linked as a **Cloudflare R2 source** in PostHog's data warehouse, as the
table `cloudflarer2.spend`: files at `daily/*.csv`, CSV with headers, double quotes on,
"Combine every file into one table" on, a **full refresh once a day at 06:00 UTC**, after the
job's 04:30 run. Every column arrives as a string, so a query casts `dollars` and `quantity`
with `toFloat`. A full refresh reads
every file again, so a day the job rewrites replaces its rows exactly. The read key PostHog
holds is an R2 token with **Object Read only** on this bucket, separate from the job's read
and write token, so PostHog holding a key can never change or delete the history it reads.

**The dashboard** is "Spend" (PostHog dashboard 1099534), six SQL tiles on that table: spend
this month, daily spend by environment, monthly spend by environment, spend by provider,
environment and area with the days each went untracked, what is not tracked on the latest
day and why, and usage this month for every provider (month-to-date figures and storage as the latest value, daily traffic and requests totalled). Totals count `bill` and `manual` rows only, so a row
not tracked adds nothing rather than zero and a waived one adds nothing paid, and the table and the not-tracked tile show where
the gaps are.

**The alert**, "A day's spend over $10", checks the last row of "Spend per day, last 14 days"
at 07:00 every morning, after the 06:00 sync, and emails the owner when the latest day's total
passes $10. Evals are the likeliest runaway: a single harness run can pass it.

**What it costs.** Each full refresh syncs the whole history, 15 to 19 rows a day of it: about
700 rows on 9 Nov 2026, so about 21,000 synced rows a month against the warehouse's 1M free,
and about 600,000 a month after three years. An hourly refresh would be 24 times that, which
is the setting that could cost something. R2 holds a few KB a day, against its 10 GB and its
free operations. The OpenAI Costs API and Neon's API are free, and Actions minutes are free on
a public repository. Checked on 9 Nov 2026.

## Running it

`.github/workflows/spend.yml` runs at 04:30 UTC every night, and by hand from the Actions
tab with an optional `from` and `to` to record or backfill a range of up to 180 days.

| It reads | Kind | Where |
|---|---|---|
| `OPENAI_ADMIN_KEY` | Actions secret | an OpenAI **admin** key, read-only, made under the organisation's admin keys; also kept in `overview-prod` |
| `NEON_API_KEY` | Actions secret | a Neon API key scoped to the one project; also kept in `overview-prod`. The project's id is in the workflow, since it is not a secret |
| `DECODO_API_KEY` | Actions secret | a Decodo public API key, from Account and Settings › API Keys; also kept in `overview-prod` |
| `CLOUDFLARE_API_TOKEN` | Actions secret | a Cloudflare API token with Account Analytics Read and Billing Read on the account; also kept in `overview-prod`. The account id is `R2_ACCOUNT_ID`, already in the workflow |
| `SPEND_R2_ACCESS_KEY_ID`, `SPEND_R2_SECRET_ACCESS_KEY` | Actions secrets | an R2 token with Object Read & Write on `the-overview-spend` only; also kept in `overview-prod` |
| `SPEND_MANUAL_ENTRIES` | Actions variable | the hand-entered figures above |

A missing OpenAI key leaves OpenAI not tracked and warns; a missing R2 key fails the run,
since nothing can be recorded.

The code is `scripts/spend/`: one module per provider, the expected rows, the CSV, the R2
store, and `recordSpend.mjs`, which puts them together. Each provider's adapter is tested
on its response shape with no live call (`npm run test:tooling`).

## What this does not do, and where it went

**Spend by area inside prod, beyond the bill's own line items, is OV-259's.** OpenAI's line
items already split generation from embeddings. Splitting generation further, into the
overview pass and each small pass, and setting the app's own metered cost against the bill
with the gap shown, needs a per-call cost the app records. The logs carry one
(`costDollars` on `api.ourKey.generated` and `api.ourKey.smallPass`, tokens on
`api.meaning.embedded`), but a log line is never what a chart is drawn from (`analytics.md`,
"Three kinds of record"), and OV-259 already records each call's cost against its account in
Postgres. So the reconciliation is built there, once, and lands on this dashboard.

**What the app meters on our key, against the bill.** `OurKeyGenerator` prices each call
from what OpenAI's response reports, at `modelPrices.ts`'s list prices, and logs it as
`costDollars` on `overview made on our key`, `overview on our key failed`, `small pass on
our key` and its failure. A check by hand on 9 Nov 2026 found it
accounting for most but not all of generation spend on ordinary days. Two things kept it
below the bill until OV-260:

- **Cache writes.** For GPT-5.6 and later OpenAI charges a cache write at 1.25× uncached
  input for the default 30-minute lifetime, and Chat Completions reports it as
  `prompt_tokens_details.cache_write_tokens`, inside `prompt_tokens` (a live response, 9 Nov
  2026). The parser read only `cached_tokens`, so writes were priced as uncached input.
  Writes are most of an overview's input, since each transcript is a prompt seen once: on
  3–8 Nov they were 61–75% of prod's Sol bill, which made the app 12–15% short on their own.
  Chat Completions accepts only the 30-minute lifetime (`'12h'` is refused), so the bill's
  `cache writes - 12hr` line comes from nothing the app sends.
- **Failed attempts.** A response that answers but fails validation is still billed. Every
  answered attempt is now metered, on success and on failure.

A response that answers with an error reports no usage and is not metered.
