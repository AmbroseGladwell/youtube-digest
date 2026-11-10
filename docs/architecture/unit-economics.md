# Unit economics: what each account costs to serve

`spend.md` says what the project spends, from each provider's bill. Bills are per key or per
project, never per reader. This doc covers the other half (OV-259): what the app records
against each account, so cost per account, per plan and per part of the stack can be set
against the bill.

## Decided (9 Nov 2026, owner)

- **Cost is recorded against each account,** not only as averages.
- **A failed attempt costs the account that asked.** OpenAI bills a response that answers
  but fails validation, so per-account totals only add up to the bill if failures count.
  They are kept apart under their own detail (`overview-failed`, `profile-failed`, …), so
  the failed share can be shown.
- **Active** means the account made at least one overview, on either key, that month, from
  `overview_usage`. Opening an overview isn't counted: only client analytics sees an open,
  and only for readers who consented.
- **PostHog reads Postgres directly** through a read-only role granted only on rollup views.
  The spend job in Actions keeps no database credential, and the API writes no files.

## What is recorded

`account_costs`: one row per UTC day, account, area and detail, holding `calls`, `quantity`
and `dollars`. Each call adds to its row. `signed_out_costs` has the same shape with no
account, for trials and signed-out callers. Neither table holds anything a reader wrote or
read.

| Area | Detail | Quantity | Dollars | Recorded by |
|---|---|---|---|---|
| `generation` | `overview`, `overview-failed` | prompt and output tokens over every attempt | list price (`modelPrices.ts`) | `OurKeyGenerator.generate` |
| `generation` | `profile`, `forAnyone`, `topics`, `topicSuggestions`, each also `-failed` | tokens | list price | `OurKeyGenerator`'s small passes |
| `embeddings` | `overview` | tokens of the claims newly embedded | $0.02 per million (`EMBEDDING_PRICE`, checked 9 Nov 2026) | `EmbeddingQueue` |
| `embeddings` | `search` | tokens of a query not already cached | the same | `MeaningSearch` |
| `transcripts` | `proxy` | bytes through the residential proxy | 0: only Decodo's bill prices it | `ServiceTranscripts` |

- **Priced where the app can price it, a quantity where only the bill can.** Generation and
  embeddings carry list-price dollars. Proxy bytes carry none, and their cost is Decodo's bill
  shared out by bytes.
- **Narration isn't recorded here.** Renders per account are already counted in
  `narration_render_usage`, and their cost is the TTS machines' bill shared out by renders.
- **A response that answers only with an error costs nothing,** since it reported no usage.
  A call with no price recorded is left out, never recorded as free
  (`docs/prototype/constraints.md`).
- **Only the caller whose fetch went through the proxy carries its bytes.** A reader who
  joins a fetch already in flight carries nothing.
- **Recording never fails the reader's request.** A write that fails logs
  `api.costs.notRecorded` and the request carries on, so a gap in the tally shows as missing
  calls, never as an error the reader sees.
- **Deleting the account deletes its rows** (`account_costs` cascades; `account-deletion.md`).
  `signed_out_costs` names no one.

## What PostHog reads

Three views in their own schema, `cost_reports` (`V0030__cost_reports.sql`), each a monthly
rollup:

| View | One row per | Holds |
|---|---|---|
| `cost_lines` | month, account, area, detail | plan, calls, quantity, dollars; signed-out callers under plan `signed-out` with no account |
| `account_months` | month, account with any activity | plan, month joined, overviews on each key, renders, metered dollars, proxy bytes, `active` |
| `plan_accounts` | plan | accounts on it now |

- **An account appears only as `md5('cost-report:' || id)`.** It isn't the account id, and it
  isn't the distinct id analytics uses, so PostHog can't join cost to a person.
- **The plan is the account's plan now,** not the plan it was on that month: plans have no
  history yet.
- **`cost_reader` can read those three views and nothing else.** The migration creates it
  without a login and with no role memberships; the tests check both. Views run with their
  owner's rights, so the reader needs nothing on the tables behind them.
- **Turning on the login is done by hand, once, on prod,** so no password is ever in the repo:
  in Neon's SQL editor, `alter role cost_reader with login password '…'`, with the password
  from Bitwarden. A role made in Neon's console or API instead joins `neon_superuser` and can
  read every table, so the reader must never be made there.
- **PostHog's Postgres source syncs the schema daily, as a full refresh.** A full refresh is
  what makes a deleted account leave PostHog's copy the next day, as the privacy policy says.
  An incremental sync would keep it.

## Still to build

- The dashboard: accounts and active accounts by plan, cost per active account by plan and
  area (average and the most expensive accounts, by opaque id), measured cost per overview and
  per render beside the tier model's assumptions, income at list price, net per plan, and the
  metered sum against each bill with the gap shown.
- Fixed costs (servers, Neon's base fee, plan fees) shared out evenly per active account,
  saying so on the dashboard.
- The tier economics model's inputs updated from the measured figures, with their date.
