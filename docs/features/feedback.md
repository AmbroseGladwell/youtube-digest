# Feedback

OV-185. A signed-in reader tells us, in their own words, that something is wrong or what
they would like. Errors and events already show crashes and presses
(`docs/architecture/errors-and-logs.md`, `analytics.md`). Feedback covers what neither
can: a verdict that was wrong, an overview that missed the point, something slow that
didn't fail, an idea. It feeds testing and feature decisions: collect it, then triage it
against the Trello board.

**Built in two slices.** Slice 1 is the plumbing in this doc: the table, the route, the
reports view and triage. Slice 2 is the screens, after a Claude Design round.

## Decisions

| Decision                                                               | Why                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Our own Postgres, not PostHog Surveys or a mailto link                 | Surveys need PostHog's browser script, and analytics only ever goes through our server, never as free text. A mailto link loses the account and the overview, and is awkward in the extension. A table keeps the words out of third parties and can be read by SQL, and by Claude for triage. |
| Signed in only (owner, 23 Nov)                                         | Generation already needs an account (`generation-behind-account`). The route has no optional session, and slice 2 hides the entry points when signed out.                                                                                                                                     |
| Deleted with the account (owner, 23 Nov)                               | Feedback is the reader's own, so it cascades from `accounts`, like the rest of what they made (`account-deletion.md`).                                                                                                                                                                        |
| No reply, no "we built this" (owner, 23 Nov)                           | Store and triage only for now. A reply by email, or showing the triage outcome back, would each be a card of its own.                                                                                                                                                                         |
| Its own route, not a kind on `/api/errors`                             | A wish isn't a failure, and errors go to PostHog. Feedback never leaves our database.                                                                                                                                                                                                         |
| Entry points: the account menu, and an overview's menu (owner, 23 Nov) | The account menu opens a modal, or a bottom sheet on a phone, for general feedback. The overview menu opens the same box carrying that overview.                                                                                                                                              |

## What is sent

`POST /api/feedback` (`FEEDBACK_PATH`), a session required, body `FeedbackRequest` in
`packages/domain/src/Feedback.ts`:

- `text`: 1 to 4,000 characters after trimming.
- `surface`: `web` or `extension`.
- `kind`: `wrong` ("Something's wrong") or `idea` ("An idea"). Optional, and the box defaults to neither.
- `overviewId`: when it was sent from an overview.
- `trail`: the error reporter's recent actions, at most 20. Kept only when `kind` is `wrong`, and only names that are in the analytics catalogue. The box says so when it sends them.

The client's version comes from the version header every call carries, and a call without
it is refused. The answer is `204`. An unknown field is `400`, so nothing extra can be
smuggled in.

Rate limit: `feedbackAccount`, 20 an hour per account (`api.md`, "Rate limits").

## Redaction

`redactFeedbackText` replaces email addresses with `<email>` (the same pattern as
`redactErrorMessage`) and anything key-shaped with `<key>`: a run of 20 or more letters,
digits, `-` or `_` that has both a letter and a digit, including one inside a link's query.
That catches API keys and sign-in tokens.

Unlike an error message, quoted titles, links and video ids are **kept**, because in
feedback they are what is being reported. The redaction runs on the server before the
insert, so the table never holds the raw text.

## What is stored

`feedback` (`V0047`): `id`, `account_id` (cascade), `created_at`, `surface`,
`client_version`, `overview_id`, `kind`, `text`, `trail` (action names), and for triage
`triaged_at`, `triage_outcome` (`supports`, `adds`, `new-card`, `not-for-us`) and
`triage_note`. Both triage fields are set together, or neither is. A partial index keeps
the untriaged entries cheap to list.

The log line `feedback.received` carries the plan, the surface, the kind, whether it came
from an overview and how many actions came with it. It never carries the text or the
overview's id.

## Reports

`cost_reports.feedback_entries`, readable by `cost_reader` and so copied daily to PostHog
(`unit-economics.md`): one row per entry with the day, the opaque account, the plan, the
surface, the kind (`none` when unset), `from_overview`, `triaged` and `outcome`. There is no
text and no overview id.

The validation dashboard (`CLAUDE.md`, habit 6) is built on this view and slice 2's events
once real entries exist. It shows:

- how much it is used, by plan and surface
- **where it works:** the share triaged into a card (`supports`, `adds`, `new-card`) against `not-for-us`, and how long entries wait untriaged
- **cost:** none, since no model or paid service is called

## Triage

Claude triages through the Neon connector against production (the project named "The
Overview App"), following `.claude/skills/triage-feedback/SKILL.md`:

1. List the untriaged entries, oldest first.
2. Match each against the board, and propose one outcome: **supports** an existing card (comment there), **adds** to an existing card (edit its text), **new-card** in Backlog from the template, or **not-for-us**.
3. Once the owner agrees, act on the board and mark the entry, with the card in the note.

An entry is marked only once its outcome is acted on, so nothing is assessed twice and
nothing marked is left undone. The board never quotes the text verbatim: the repo and the
board are public-facing, so a card describes the request in general terms
(`no-reader-content-in-public-repo`).

## Slice 2: the screens

Waits on a Claude Design round for:

- the box: one text box with a real label, the optional kind, a plain line saying what is sent with it
- its confirmation: "Thanks, we read every one", announced, after which the box clears
- the modal and the phone's bottom sheet
- the two entry points

It adds the analytics events (opened, sent with surface and kind, never the text) and IWFT
coverage: sending from both entry points on the web and in the panel, the confirmation
announced, and reflow at 400% zoom and on a phone.
